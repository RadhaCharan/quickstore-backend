import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { IsString, IsNotEmpty, IsOptional, IsUUID, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;
}

@Injectable()
export class CategoryService {
  constructor(private readonly dataSource: DataSource) {}

  private buildSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  // Auto-suffixes on collision ("dairy" -> "dairy-2") instead of failing outright — the
  // usual behavior for slugs/handles (Shopify, WooCommerce, …). `excludeId` lets a rename
  // re-check against every *other* category without colliding with its own current slug.
  private async uniqueSlug(schemaName: string, base: string, excludeId?: string): Promise<string> {
    const s = `"${schemaName}"`;
    let candidate = base;
    for (let n = 2; ; n++) {
      const rows = await this.dataSource.query(
        excludeId
          ? `SELECT id FROM ${s}.categories WHERE slug = $1 AND id != $2`
          : `SELECT id FROM ${s}.categories WHERE slug = $1`,
        excludeId ? [candidate, excludeId] : [candidate],
      );
      if (!rows.length) return candidate;
      candidate = `${base}-${n}`;
    }
  }

  // Allowlist only — sortBy is user input and must never be interpolated into SQL directly.
  private static readonly SORT_COLUMNS: Record<string, string> = {
    name: 'c.name',
    sortOrder: 'c.sort_order',
    productCount: 'product_count',
  };

  async findAll(
    schemaName: string,
    page = 1,
    limit = 20,
    search?: string,
    sortBy?: string,
    sortDir?: 'asc' | 'desc',
  ) {
    const s = `"${schemaName}"`;
    const offset = (page - 1) * limit;
    const params: any[] = [`%${search ?? ''}%`];

    const orderCol = CategoryService.SORT_COLUMNS[sortBy ?? ''] ?? 'c.sort_order';
    const dir = sortDir === 'desc' ? 'DESC' : 'ASC';

    params.push(limit, offset);
    const rows = await this.dataSource.query(
      `SELECT c.*, (SELECT COUNT(*) FROM ${s}.products p WHERE p.category_id = c.id AND p.is_active = true)::int as product_count
       FROM ${s}.categories c
       WHERE c.is_active = true AND c.name ILIKE $1
       ORDER BY ${orderCol} ${dir}, c.name ASC
       LIMIT $2 OFFSET $3`,
      params,
    );

    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) FROM ${s}.categories c WHERE c.is_active = true AND c.name ILIKE $1`,
      [`%${search ?? ''}%`],
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
      `SELECT * FROM ${s}.categories WHERE id = $1`,
      [id],
    );
    if (!rows.length) throw new NotFoundException(`Category ${id} not found`);
    return rows[0];
  }

  async create(schemaName: string, dto: CreateCategoryDto) {
    const s = `"${schemaName}"`;
    const slug = await this.uniqueSlug(schemaName, dto.slug ?? this.buildSlug(dto.name));

    const rows = await this.dataSource.query(
      `INSERT INTO ${s}.categories (name, slug, parent_id, image_url, sort_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [dto.name, slug, dto.parentId ?? null, dto.imageUrl ?? null, dto.sortOrder ?? 0],
    );
    return rows[0];
  }

  async update(schemaName: string, id: string, dto: Partial<CreateCategoryDto>) {
    await this.findOne(schemaName, id);
    const s = `"${schemaName}"`;
    const sets: string[] = [];
    const params: any[] = [];

    if (dto.name !== undefined) { params.push(dto.name); sets.push(`name = $${params.length}`); }

    // Renaming should free up the old slug — regenerate it from the new name unless the
    // caller explicitly passed one (fixes renamed categories permanently squatting their
    // old slug and blocking a future category from reusing it).
    let slug = dto.slug;
    if (slug === undefined && dto.name !== undefined) {
      slug = await this.uniqueSlug(schemaName, this.buildSlug(dto.name), id);
    }
    if (slug !== undefined) { params.push(slug); sets.push(`slug = $${params.length}`); }

    if (dto.parentId !== undefined) { params.push(dto.parentId); sets.push(`parent_id = $${params.length}`); }
    if (dto.imageUrl !== undefined) { params.push(dto.imageUrl); sets.push(`image_url = $${params.length}`); }
    if (dto.sortOrder !== undefined) { params.push(dto.sortOrder); sets.push(`sort_order = $${params.length}`); }

    if (!sets.length) return this.findOne(schemaName, id);

    params.push(id);
    const rows = await this.dataSource.query(
      `UPDATE ${s}.categories SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    return rows[0];
  }

  async remove(schemaName: string, id: string) {
    await this.findOne(schemaName, id);
    const s = `"${schemaName}"`;
    await this.dataSource.query(
      `UPDATE ${s}.categories SET is_active = false WHERE id = $1`,
      [id],
    );
    return { message: 'Category deactivated', id };
  }
}
