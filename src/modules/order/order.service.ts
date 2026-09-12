import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateOrderDto } from './dto/create-order.dto';
import { CustomerService } from '../customer/customer.service';
import { DiscountService } from '../discount/discount.service';

@Injectable()
export class OrderService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly customerService: CustomerService,
    private readonly discountService: DiscountService,
  ) {}

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  }

  async placeOrder(schemaName: string, dto: CreateOrderDto, customerPhone: string) {
    const s = `"${schemaName}"`;

    // The customer JWT only carries the phone number — resolve (or lazily create) their
    // actual customer row so we have the UUID that orders.customer_id requires.
    const customer = await this.customerService.getOrCreateByPhone(schemaName, customerPhone);

    // Checkout's "name" field is, in practice, the only place a customer's name is ever
    // collected — without this, every customer stays permanently nameless in the vendor's
    // Orders and Customers admin pages.
    if (dto.customerName?.trim() && dto.customerName.trim() !== customer.name) {
      await this.customerService.updateMe(schemaName, customerPhone, { name: dto.customerName.trim() });
    }

    // Resolve the delivery address: either a previously-saved addressId, or an inline
    // address supplied straight from the checkout form (which we save for next time).
    let addressId = dto.addressId;
    if (addressId) {
      const [existing] = await this.dataSource.query(
        `SELECT id FROM ${s}.addresses WHERE id = $1 AND customer_id = $2`,
        [addressId, customer.id],
      );
      if (!existing) throw new NotFoundException('Address not found');
    } else if (dto.address) {
      const saved = await this.customerService.addAddress(schemaName, customerPhone, {
        line1: dto.address.line1,
        line2: dto.address.line2,
        city: dto.address.city,
        pincode: dto.address.pincode,
      });
      addressId = saved.id;
    } else {
      throw new BadRequestException('A delivery address is required');
    }

    // Fetch products to ensure stock and compute subtotal
    let subtotal = 0;
    const itemsData: any[] = [];

    for (const it of dto.items) {
      const rows = await this.dataSource.query(
        `SELECT id, name, price, stock FROM ${s}.products WHERE id = $1 AND is_active = true`,
        [it.productId],
      );
      if (!rows.length) throw new NotFoundException(`Product ${it.productId} not found`);
      const prod = rows[0];
      if (prod.stock < it.quantity) {
        throw new BadRequestException(`Insufficient stock for "${prod.name}" (available: ${prod.stock})`);
      }
      const itemSubtotal = prod.price * it.quantity;
      itemsData.push({
        productId: prod.id,
        productName: prod.name,
        price: prod.price,
        quantity: it.quantity,
        subtotal: itemSubtotal,
      });
      subtotal += itemSubtotal;
    }

    // Discount — re-validated server-side even if the customer already "applied" it in the UI,
    // since it could have expired or hit its usage limit in the meantime.
    let discountAmt = 0;
    if (dto.couponCode) {
      const applied = await this.discountService.applyDiscount(schemaName, dto.couponCode, subtotal);
      discountAmt = applied.discountAmt;
    }

    // Delivery fee — pulled from the tenant's own storefront settings (free above a threshold).
    const [config] = await this.dataSource.query(
      `SELECT delivery_fee, free_delivery_above FROM ${s}.storefront_config LIMIT 1`,
    );
    let deliveryFee = Number(config?.delivery_fee || 0);
    if (config?.free_delivery_above && subtotal >= Number(config.free_delivery_above)) {
      deliveryFee = 0;
    }

    const total = subtotal - discountAmt + deliveryFee;

    const orderNumber = this.generateOrderNumber();

    // Insert order
    const [order] = await this.dataSource.query(
      `INSERT INTO ${s}.orders
         (order_number, customer_id, address_id, status, subtotal, discount_amt, delivery_fee, total, payment_mode, payment_status, notes)
       VALUES ($1,$2,$3,'PLACED',$4,$5,$6,$7,$8,'PENDING',$9)
       RETURNING *`,
      [
        orderNumber,
        customer.id,
        addressId,
        subtotal,
        discountAmt,
        deliveryFee,
        total,
        dto.paymentMode,
        dto.notes ?? null,
      ],
    );

    // Insert order items and reduce stock
    for (const item of itemsData) {
      await this.dataSource.query(
        `INSERT INTO ${s}.order_items
           (order_id, product_id, product_name, price, quantity, subtotal)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [order.id, item.productId, item.productName, item.price, item.quantity, item.subtotal],
      );
      await this.dataSource.query(
        `UPDATE ${s}.products SET stock = stock - $1, updated_at = NOW() WHERE id = $2`,
        [item.quantity, item.productId],
      );
    }

    if (dto.couponCode && discountAmt > 0) {
      await this.discountService.incrementUsage(schemaName, dto.couponCode);
    }

    return { ...this.mapOrderRow(order), items: itemsData };
  }

  // orders is all snake_case DB columns — every consumer (admin Orders list/detail,
  // customer order history) reads camelCase, plus wants the customer name/phone and the
  // delivery address alongside the order instead of having to look them up separately.
  private mapOrderRow(o: any) {
    return {
      id: o.id,
      orderNumber: o.order_number,
      status: o.status,
      subtotal: Number(o.subtotal),
      discountAmt: Number(o.discount_amt),
      deliveryFee: Number(o.delivery_fee),
      total: Number(o.total),
      paymentMode: o.payment_mode,
      paymentStatus: o.payment_status,
      notes: o.notes,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
      customerName: o.customer_name ?? null,
      customerPhone: o.customer_phone ?? null,
      address: o.address_line1 ? {
        line1: o.address_line1,
        line2: o.address_line2,
        city: o.address_city,
        pincode: o.address_pincode,
      } : null,
    };
  }

  private static readonly ORDER_JOIN_SELECT = `
    o.*, c.name as customer_name, c.phone as customer_phone,
    a.line1 as address_line1, a.line2 as address_line2, a.city as address_city, a.pincode as address_pincode`;

  private orderJoinFrom(s: string) {
    return `FROM ${s}.orders o
      LEFT JOIN ${s}.customers c ON c.id = o.customer_id
      LEFT JOIN ${s}.addresses a ON a.id = o.address_id`;
  }

  /** A customer's own order history — scoped to them, unlike the vendor-wide getAll(). */
  async getMine(schemaName: string, customerPhone: string) {
    const s = `"${schemaName}"`;
    const customer = await this.customerService.getOrCreateByPhone(schemaName, customerPhone);
    const rows = await this.dataSource.query(
      `SELECT ${OrderService.ORDER_JOIN_SELECT} ${this.orderJoinFrom(s)}
       WHERE o.customer_id = $1 ORDER BY o.created_at DESC`,
      [customer.id],
    );
    return rows.map((r: any) => this.mapOrderRow(r));
  }

  async updateStatus(schemaName: string, orderId: string, status: string) {
    const s = `"${schemaName}"`;
    const [order] = await this.dataSource.query(
      `UPDATE ${s}.orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, orderId],
    );
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    return order;
  }

  async getAll(schemaName: string, page = 1, limit = 20, status?: string) {
    const s = `"${schemaName}"`;
    const offset = (page - 1) * limit;
    let whereClause = '';
    const params: any[] = [];

    if (status) {
      params.push(status);
      whereClause = `WHERE o.status = $${params.length}`;
    }

    params.push(limit, offset);

    const rows = await this.dataSource.query(
      `SELECT ${OrderService.ORDER_JOIN_SELECT} ${this.orderJoinFrom(s)}
       ${whereClause}
       ORDER BY o.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) FROM ${s}.orders o ${whereClause}`,
      status ? [status] : [],
    );

    return {
      data: rows.map((r: any) => this.mapOrderRow(r)),
      total: Number(count),
      page,
      limit,
      totalPages: Math.ceil(Number(count) / limit),
    };
  }

  async getAnalytics(schemaName: string) {
    const s = `"${schemaName}"`;

    const [{ total_orders }] = await this.dataSource.query(
      `SELECT COUNT(*) as total_orders FROM ${s}.orders`,
    );

    const [{ total_revenue }] = await this.dataSource.query(
      `SELECT COALESCE(SUM(total), 0) as total_revenue FROM ${s}.orders WHERE payment_status = 'PAID'`,
    );

    const [{ today_orders }] = await this.dataSource.query(
      `SELECT COUNT(*) as today_orders FROM ${s}.orders WHERE created_at >= CURRENT_DATE`,
    );

    const [{ today_revenue }] = await this.dataSource.query(
      `SELECT COALESCE(SUM(total), 0) as today_revenue FROM ${s}.orders WHERE created_at >= CURRENT_DATE`,
    );

    const [{ total_customers }] = await this.dataSource.query(
      `SELECT COUNT(*) as total_customers FROM ${s}.customers`,
    );

    const statusBreakdown = await this.dataSource.query(
      `SELECT status, COUNT(*) as count FROM ${s}.orders GROUP BY status`,
    );

    const recentOrders = await this.dataSource.query(
      `SELECT ${OrderService.ORDER_JOIN_SELECT} ${this.orderJoinFrom(s)}
       ORDER BY o.created_at DESC LIMIT 10`,
    );

    return {
      totalOrders: Number(total_orders),
      totalRevenue: Number(total_revenue),
      todayOrders: Number(today_orders),
      todayRevenue: Number(today_revenue),
      totalCustomers: Number(total_customers),
      statusBreakdown: statusBreakdown.map((r: any) => ({ status: r.status, count: Number(r.count) })),
      recentOrders: recentOrders.map((r: any) => this.mapOrderRow(r)),
    };
  }

  /** One row per calendar day over the last `days` days (zero-filled, not just days with orders) — powers the dashboard's trend charts. */
  async getTimeseries(schemaName: string, days = 30) {
    const s = `"${schemaName}"`;
    const clampedDays = Math.min(90, Math.max(1, Math.floor(days) || 30));
    const rows = await this.dataSource.query(
      `SELECT to_char(d::date, 'YYYY-MM-DD') as date,
              COUNT(o.id)::int as orders,
              COALESCE(SUM(o.total) FILTER (WHERE o.payment_status = 'PAID'), 0) as revenue
       FROM generate_series((CURRENT_DATE - ($1::int - 1)), CURRENT_DATE, interval '1 day') d
       LEFT JOIN ${s}.orders o ON o.created_at::date = d::date
       GROUP BY d
       ORDER BY d`,
      [clampedDays],
    );
    return rows.map((r: any) => ({ date: r.date, orders: Number(r.orders), revenue: Number(r.revenue) }));
  }

  // Customer-facing URLs use the friendly order number (e.g. "ORD-MTYRXH3C-Y602"), same as
  // any real storefront's order-tracking link — only the internal UUID FK relationships care
  // about `id`. Accept either here rather than forcing the frontend to know which one to send
  // (sending the order number against a UUID column previously 500'd outright).
  private static readonly UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  async getOne(schemaName: string, idOrOrderNumber: string) {
    const s = `"${schemaName}"`;
    const column = OrderService.UUID_RE.test(idOrOrderNumber) ? 'o.id' : 'o.order_number';
    const [order] = await this.dataSource.query(
      `SELECT ${OrderService.ORDER_JOIN_SELECT} ${this.orderJoinFrom(s)} WHERE ${column} = $1`,
      [idOrOrderNumber],
    );
    if (!order) throw new NotFoundException(`Order ${idOrOrderNumber} not found`);

    const items = await this.dataSource.query(
      `SELECT id, product_id as "productId", product_name as "productName", price, quantity, subtotal
       FROM ${s}.order_items WHERE order_id = $1`,
      [order.id],
    );

    return { ...this.mapOrderRow(order), items };
  }
}
