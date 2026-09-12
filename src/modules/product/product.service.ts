import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';

@Injectable()
export class ProductService {
  constructor(private readonly dataSource: DataSource) {}

  async findAll(
    schemaName: string,
    page = 1,
    limit = 20,
    search?: string,
    categoryId?: string,
  ) {
    const offset = (page - 1) * limit;
    const s = `"${schemaName}"`;
    const params: any[] = [`%${search ?? ''}%`, limit, offset];
    let whereExtra = '';
    if (categoryId) {
      params.push(categoryId);
      whereExtra = `AND category_id = $${params.length}`;
    }

    const rows = await this.dataSource.query(
      `SELECT * FROM ${s}.products
       WHERE is_active = true AND name ILIKE $1
       ${whereExtra}
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      params,
    );

    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) FROM ${s}.products
       WHERE is_active = true AND name ILIKE $1 ${whereExtra}`,
      categoryId ? [`%${search ?? ''}%`, categoryId] : [`%${search ?? ''}%`],
    );

    return {
      data: rows,
      total: Number(count),
      page,
      limit,
      totalPages: Math.ceil(Number(count) / limit),
    };
  }

  async findOne(schemaName: string, id: string) {
    const s = `"${schemaName}"`;
    const rows = await this.dataSource.query(
      `SELECT * FROM ${s}.products WHERE id = $1 AND is_active = true`,
      [id],
    );
    if (!rows.length) throw new NotFoundException(`Product ${id} not found`);
    return rows[0];
  }

  async create(schemaName: string, dto: CreateProductDto) {
    const s = `"${schemaName}"`;
    const images = dto.images ?? [];
    const rows = await this.dataSource.query(
      `INSERT INTO ${s}.products
         (name, description, price, mrp, stock, unit, category_id, images)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        dto.name,
        dto.description ?? null,
        dto.price,
        dto.mrp ?? null,
        dto.stock,
        dto.unit ?? null,
        dto.categoryId ?? null,
        `{${images.map((i) => `"${i}"`).join(',')}}`,
      ],
    );
    return rows[0];
  }

  async update(schemaName: string, id: string, dto: Partial<CreateProductDto>) {
    await this.findOne(schemaName, id); // ensure exists
    const s = `"${schemaName}"`;
    const sets: string[] = [];
    const params: any[] = [];

    if (dto.name !== undefined) { params.push(dto.name); sets.push(`name = $${params.length}`); }
    if (dto.description !== undefined) { params.push(dto.description); sets.push(`description = $${params.length}`); }
    if (dto.price !== undefined) { params.push(dto.price); sets.push(`price = $${params.length}`); }
    if (dto.mrp !== undefined) { params.push(dto.mrp); sets.push(`mrp = $${params.length}`); }
    if (dto.stock !== undefined) { params.push(dto.stock); sets.push(`stock = $${params.length}`); }
    if (dto.unit !== undefined) { params.push(dto.unit); sets.push(`unit = $${params.length}`); }
    if (dto.categoryId !== undefined) { params.push(dto.categoryId); sets.push(`category_id = $${params.length}`); }
    if (dto.images !== undefined) {
      params.push(`{${dto.images.map((i) => `"${i}"`).join(',')}}`);
      sets.push(`images = $${params.length}`);
    }

    if (!sets.length) return this.findOne(schemaName, id);

    sets.push(`updated_at = NOW()`);
    params.push(id);

    const rows = await this.dataSource.query(
      `UPDATE ${s}.products SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    return rows[0];
  }

  async remove(schemaName: string, id: string) {
    await this.findOne(schemaName, id);
    const s = `"${schemaName}"`;
    await this.dataSource.query(
      `UPDATE ${s}.products SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id],
    );
    return { message: 'Product deactivated', id };
  }

  async updateStock(schemaName: string, id: string, qty: number) {
    await this.findOne(schemaName, id);
    const s = `"${schemaName}"`;
    const rows = await this.dataSource.query(
      `UPDATE ${s}.products SET stock = stock + $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, stock`,
      [qty, id],
    );
    return rows[0];
  }
}
