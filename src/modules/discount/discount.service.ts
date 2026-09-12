import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

export class CreateDiscountDto {
  code: string;
  type: 'PERCENTAGE' | 'FLAT';
  value: number;
  minOrderAmt?: number;
  maxDiscount?: number;
  usageLimit?: number;
  validFrom?: string;
  validUntil?: string;
}

@Injectable()
export class DiscountService {
  constructor(private readonly dataSource: DataSource) {}

  async applyDiscount(schemaName: string, code: string, orderAmount: number) {
    const s = `"${schemaName}"`;
    const now = new Date();

    const rows = await this.dataSource.query(
      `SELECT * FROM ${s}.discounts
       WHERE code = $1 AND is_active = true
         AND (valid_from IS NULL OR valid_from <= $2)
         AND (valid_until IS NULL OR valid_until >= $2)
         AND (usage_limit IS NULL OR used_count < usage_limit)`,
      [code.toUpperCase(), now],
    );

    if (!rows.length) throw new BadRequestException('Invalid or expired coupon code');

    const discount = rows[0];

    if (orderAmount < discount.min_order_amt) {
      throw new BadRequestException(
        `Minimum order amount for this coupon is ₹${discount.min_order_amt}`,
      );
    }

    let discountAmt = 0;
    if (discount.type === 'PERCENTAGE') {
      discountAmt = (orderAmount * discount.value) / 100;
      if (discount.max_discount) {
        discountAmt = Math.min(discountAmt, discount.max_discount);
      }
    } else {
      discountAmt = Math.min(discount.value, orderAmount);
    }

    return {
      code: discount.code,
      type: discount.type,
      discountAmt: parseFloat(discountAmt.toFixed(2)),
      finalAmount: parseFloat((orderAmount - discountAmt).toFixed(2)),
    };
  }

  async createDiscount(schemaName: string, dto: CreateDiscountDto) {
    const s = `"${schemaName}"`;
    const rows = await this.dataSource.query(
      `INSERT INTO ${s}.discounts
         (code, type, value, min_order_amt, max_discount, usage_limit, valid_from, valid_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        dto.code.toUpperCase(),
        dto.type,
        dto.value,
        dto.minOrderAmt ?? 0,
        dto.maxDiscount ?? null,
        dto.usageLimit ?? null,
        dto.validFrom ?? null,
        dto.validUntil ?? null,
      ],
    );
    return rows[0];
  }

  async listDiscounts(schemaName: string) {
    const s = `"${schemaName}"`;
    return this.dataSource.query(
      `SELECT * FROM ${s}.discounts ORDER BY is_active DESC, code ASC`,
    );
  }

  async updateDiscount(schemaName: string, id: string, dto: Partial<CreateDiscountDto>) {
    const s = `"${schemaName}"`;
    const sets: string[] = [];
    const params: any[] = [];

    if (dto.code !== undefined) { params.push(dto.code.toUpperCase()); sets.push(`code = $${params.length}`); }
    if (dto.type !== undefined) { params.push(dto.type); sets.push(`type = $${params.length}`); }
    if (dto.value !== undefined) { params.push(dto.value); sets.push(`value = $${params.length}`); }
    if (dto.minOrderAmt !== undefined) { params.push(dto.minOrderAmt); sets.push(`min_order_amt = $${params.length}`); }
    if (dto.maxDiscount !== undefined) { params.push(dto.maxDiscount); sets.push(`max_discount = $${params.length}`); }
    if (dto.usageLimit !== undefined) { params.push(dto.usageLimit); sets.push(`usage_limit = $${params.length}`); }
    if (dto.validFrom !== undefined) { params.push(dto.validFrom); sets.push(`valid_from = $${params.length}`); }
    if (dto.validUntil !== undefined) { params.push(dto.validUntil); sets.push(`valid_until = $${params.length}`); }

    if (!sets.length) throw new BadRequestException('No fields to update');

    params.push(id);
    const rows = await this.dataSource.query(
      `UPDATE ${s}.discounts SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (!rows.length) throw new NotFoundException(`Discount ${id} not found`);
    return rows[0];
  }

  async deactivateDiscount(schemaName: string, id: string) {
    const s = `"${schemaName}"`;
    const rows = await this.dataSource.query(
      `UPDATE ${s}.discounts SET is_active = false WHERE id = $1 RETURNING id, code`,
      [id],
    );
    if (!rows.length) throw new NotFoundException(`Discount ${id} not found`);
    return { message: 'Discount deactivated', ...rows[0] };
  }
}
