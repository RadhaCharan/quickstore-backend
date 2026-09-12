import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrderService {
  constructor(private readonly dataSource: DataSource) {}

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  }

  async placeOrder(schemaName: string, dto: CreateOrderDto, customerId: string) {
    const s = `"${schemaName}"`;

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

    // Discount calculation placeholder (integrate with discount module if coupon provided)
    const discountAmt = 0; // TODO: validate and apply coupon

    // Delivery fee (static for POC)
    const deliveryFee = 0; // or 40 if needed

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
        customerId,
        dto.addressId ?? null,
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

    return { order, items: itemsData };
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
      whereClause = `WHERE status = $${params.length}`;
    }

    params.push(limit, offset);

    const rows = await this.dataSource.query(
      `SELECT * FROM ${s}.orders ${whereClause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) FROM ${s}.orders ${whereClause}`,
      status ? [status] : [],
    );

    return {
      data: rows,
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

    const statusBreakdown = await this.dataSource.query(
      `SELECT status, COUNT(*) as count FROM ${s}.orders GROUP BY status`,
    );

    return {
      totalOrders: Number(total_orders),
      totalRevenue: Number(total_revenue),
      statusBreakdown,
    };
  }

  async getOne(schemaName: string, orderId: string) {
    const s = `"${schemaName}"`;
    const [order] = await this.dataSource.query(
      `SELECT * FROM ${s}.orders WHERE id = $1`,
      [orderId],
    );
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    const items = await this.dataSource.query(
      `SELECT * FROM ${s}.order_items WHERE order_id = $1`,
      [orderId],
    );

    return { ...order, items };
  }
}
