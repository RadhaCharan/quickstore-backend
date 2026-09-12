import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { IsString, IsNotEmpty, IsIn, IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';
import { Transform } from 'class-transformer';

// Blank strings come from number/date inputs left empty — treat them as "not provided"
// rather than letting them fail their type validator.
const blankToUndefined = ({ value }: { value: any }) => (value === '' || value === null ? undefined : value);
const toOptionalNumber = ({ value }: { value: any }) => (value === '' || value === null || value === undefined ? undefined : Number(value));

export class CreateDiscountDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsIn(['PERCENTAGE', 'FLAT'])
  type: 'PERCENTAGE' | 'FLAT';

  @Transform(toOptionalNumber)
  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsNumber()
  @Min(0)
  minOrderAmt?: number;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsNumber()
  @Min(0)
  maxDiscount?: number;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsNumber()
  @Min(1)
  usageLimit?: number;

  @IsOptional()
  @Transform(blankToUndefined)
  @IsString()
  validFrom?: string;

  @IsOptional()
  @Transform(blankToUndefined)
  @IsString()
  validUntil?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Injectable()
export class DiscountService {
  constructor(private readonly dataSource: DataSource) {}

  async applyDiscount(schemaName: string, code: string, orderAmount: number) {
    const s = `"${schemaName}"`;
    const now = new Date();

    // Look the code up on its own first so the error can say *why* it's unusable
    // ("expired", "no longer active", …) instead of one generic catch-all message.
    const [discount] = await this.dataSource.query(
      `SELECT * FROM ${s}.discounts WHERE code = $1`,
      [code.toUpperCase()],
    );

    if (!discount) throw new BadRequestException(`Coupon code "${code.toUpperCase()}" doesn't exist`);
    if (!discount.is_active) throw new BadRequestException('This coupon is no longer active');
    if (discount.valid_from && new Date(discount.valid_from) > now) {
      throw new BadRequestException(`This coupon isn't active until ${new Date(discount.valid_from).toLocaleDateString('en-IN')}`);
    }
    if (discount.valid_until && new Date(discount.valid_until) < now) {
      throw new BadRequestException('This coupon has expired');
    }
    if (discount.usage_limit != null && discount.used_count >= discount.usage_limit) {
      throw new BadRequestException('This coupon has reached its usage limit');
    }

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
      value: Number(discount.value),
      minOrderAmt: Number(discount.min_order_amt),
      maxDiscount: discount.max_discount != null ? Number(discount.max_discount) : null,
      discountAmt: parseFloat(discountAmt.toFixed(2)),
      finalAmount: parseFloat((orderAmount - discountAmt).toFixed(2)),
    };
  }

  /** Bumps used_count after an order that redeemed `code` is successfully placed. */
  async incrementUsage(schemaName: string, code: string) {
    const s = `"${schemaName}"`;
    await this.dataSource.query(
      `UPDATE ${s}.discounts SET used_count = used_count + 1 WHERE code = $1`,
      [code.toUpperCase()],
    );
  }

  // The admin Discounts page reads camelCase — map the raw snake_case row so isActive,
  // minOrderAmt, usageLimit, usedCount and validUntil don't silently read as undefined.
  private mapDiscountRow(d: any) {
    return {
      id: d.id,
      code: d.code,
      type: d.type,
      value: Number(d.value),
      minOrderAmt: Number(d.min_order_amt),
      maxDiscount: d.max_discount != null ? Number(d.max_discount) : null,
      usageLimit: d.usage_limit != null ? Number(d.usage_limit) : null,
      usedCount: Number(d.used_count),
      validFrom: d.valid_from,
      validUntil: d.valid_until,
      isActive: d.is_active,
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
    return this.mapDiscountRow(rows[0]);
  }

  async listDiscounts(schemaName: string) {
    const s = `"${schemaName}"`;
    const rows = await this.dataSource.query(
      `SELECT * FROM ${s}.discounts ORDER BY is_active DESC, code ASC`,
    );
    return rows.map((r: any) => this.mapDiscountRow(r));
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
    if (dto.isActive !== undefined) { params.push(dto.isActive); sets.push(`is_active = $${params.length}`); }

    if (!sets.length) throw new BadRequestException('No fields to update');

    params.push(id);
    const rows = await this.dataSource.query(
      `UPDATE ${s}.discounts SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (!rows.length) throw new NotFoundException(`Discount ${id} not found`);
    return this.mapDiscountRow(rows[0]);
  }

  /** Permanently removes a coupon — safe because no order stores a foreign key to it. */
  async deleteDiscount(schemaName: string, id: string) {
    const s = `"${schemaName}"`;
    const rows = await this.dataSource.query(
      `DELETE FROM ${s}.discounts WHERE id = $1 RETURNING id, code`,
      [id],
    );
    if (!rows.length) throw new NotFoundException(`Discount ${id} not found`);
    return { message: 'Discount deleted', ...rows[0] };
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
