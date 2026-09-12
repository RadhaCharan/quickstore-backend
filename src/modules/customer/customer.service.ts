import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export class UpdateCustomerDto {
  name?: string;
  email?: string;
}

export class CreateAddressDto {
  label?: string;
  line1: string;
  line2?: string;
  city?: string;
  pincode?: string;
  lat?: number;
  lng?: number;
  isDefault?: boolean;
}

@Injectable()
export class CustomerService {
  constructor(private readonly dataSource: DataSource) {}

  // ─── Vendor: list / detail ────────────────────────────────────────────────────

  async getAllCustomers(schemaName: string, page = 1, limit = 20, search?: string) {
    const s = `"${schemaName}"`;
    const offset = (page - 1) * limit;
    const rows = await this.dataSource.query(
      `SELECT id, name, phone, email, created_at
       FROM ${s}.customers
       WHERE name ILIKE $1 OR phone ILIKE $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [`%${search ?? ''}%`, limit, offset],
    );
    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) FROM ${s}.customers WHERE name ILIKE $1 OR phone ILIKE $1`,
      [`%${search ?? ''}%`],
    );
    return { data: rows, total: Number(count), page, limit };
  }

  async getCustomerById(schemaName: string, id: string) {
    const s = `"${schemaName}"`;
    const rows = await this.dataSource.query(
      `SELECT c.*, json_agg(a.*) FILTER (WHERE a.id IS NOT NULL) as addresses
       FROM ${s}.customers c
       LEFT JOIN ${s}.addresses a ON a.customer_id = c.id
       WHERE c.id = $1
       GROUP BY c.id`,
      [id],
    );
    if (!rows.length) throw new NotFoundException(`Customer ${id} not found`);
    return rows[0];
  }

  // ─── Customer: self-service ───────────────────────────────────────────────────

  async getOrCreateByPhone(schemaName: string, phone: string): Promise<any> {
    const s = `"${schemaName}"`;
    const existing = await this.dataSource.query(
      `SELECT * FROM ${s}.customers WHERE phone = $1`,
      [phone],
    );
    if (existing.length) return existing[0];

    const created = await this.dataSource.query(
      `INSERT INTO ${s}.customers (phone) VALUES ($1) RETURNING *`,
      [phone],
    );
    return created[0];
  }

  async getMe(schemaName: string, phone: string) {
    const s = `"${schemaName}"`;
    const rows = await this.dataSource.query(
      `SELECT * FROM ${s}.customers WHERE phone = $1`,
      [phone],
    );
    if (!rows.length) {
      // Auto-create on first login
      return this.getOrCreateByPhone(schemaName, phone);
    }
    return rows[0];
  }

  async updateMe(schemaName: string, phone: string, dto: UpdateCustomerDto) {
    const s = `"${schemaName}"`;
    const sets: string[] = [];
    const params: any[] = [];

    if (dto.name !== undefined) { params.push(dto.name); sets.push(`name = $${params.length}`); }
    if (dto.email !== undefined) { params.push(dto.email); sets.push(`email = $${params.length}`); }

    if (!sets.length) return this.getMe(schemaName, phone);

    params.push(phone);
    const rows = await this.dataSource.query(
      `UPDATE ${s}.customers SET ${sets.join(', ')} WHERE phone = $${params.length} RETURNING *`,
      params,
    );
    if (!rows.length) throw new NotFoundException('Customer profile not found');
    return rows[0];
  }

  // ─── Addresses ────────────────────────────────────────────────────────────────

  async getAddresses(schemaName: string, phone: string) {
    const customer = await this.getMe(schemaName, phone);
    const s = `"${schemaName}"`;
    return this.dataSource.query(
      `SELECT * FROM ${s}.addresses WHERE customer_id = $1 ORDER BY is_default DESC`,
      [customer.id],
    );
  }

  async addAddress(schemaName: string, phone: string, dto: CreateAddressDto) {
    const customer = await this.getMe(schemaName, phone);
    const s = `"${schemaName}"`;

    if (dto.isDefault) {
      // Clear other defaults
      await this.dataSource.query(
        `UPDATE ${s}.addresses SET is_default = false WHERE customer_id = $1`,
        [customer.id],
      );
    }

    const rows = await this.dataSource.query(
      `INSERT INTO ${s}.addresses
         (customer_id, label, line1, line2, city, pincode, lat, lng, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        customer.id,
        dto.label ?? null,
        dto.line1,
        dto.line2 ?? null,
        dto.city ?? null,
        dto.pincode ?? null,
        dto.lat ?? null,
        dto.lng ?? null,
        dto.isDefault ?? false,
      ],
    );
    return rows[0];
  }

  async updateAddress(schemaName: string, phone: string, addressId: string, dto: Partial<CreateAddressDto>) {
    const customer = await this.getMe(schemaName, phone);
    const s = `"${schemaName}"`;

    if (dto.isDefault) {
      await this.dataSource.query(
        `UPDATE ${s}.addresses SET is_default = false WHERE customer_id = $1`,
        [customer.id],
      );
    }

    const sets: string[] = [];
    const params: any[] = [];
    if (dto.label !== undefined) { params.push(dto.label); sets.push(`label = $${params.length}`); }
    if (dto.line1 !== undefined) { params.push(dto.line1); sets.push(`line1 = $${params.length}`); }
    if (dto.line2 !== undefined) { params.push(dto.line2); sets.push(`line2 = $${params.length}`); }
    if (dto.city !== undefined) { params.push(dto.city); sets.push(`city = $${params.length}`); }
    if (dto.pincode !== undefined) { params.push(dto.pincode); sets.push(`pincode = $${params.length}`); }
    if (dto.lat !== undefined) { params.push(dto.lat); sets.push(`lat = $${params.length}`); }
    if (dto.lng !== undefined) { params.push(dto.lng); sets.push(`lng = $${params.length}`); }
    if (dto.isDefault !== undefined) { params.push(dto.isDefault); sets.push(`is_default = $${params.length}`); }

    if (!sets.length) throw new NotFoundException('No fields to update');

    params.push(addressId, customer.id);
    const rows = await this.dataSource.query(
      `UPDATE ${s}.addresses SET ${sets.join(', ')}
       WHERE id = $${params.length - 1} AND customer_id = $${params.length} RETURNING *`,
      params,
    );
    if (!rows.length) throw new NotFoundException(`Address ${addressId} not found`);
    return rows[0];
  }
}
