import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export class CreateCategoryDto {
  name: string;
  slug?: string;
  parentId?: string;
  imageUrl?: string;
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

  async findAll(schemaName: string) {
    const s = `"${schemaName}"`;
    return this.dataSource.query(
      `SELECT * FROM ${s}.categories WHERE is_active = true ORDER BY sort_order ASC, name ASC`,
    );
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
    const slug = dto.slug ?? this.buildSlug(dto.name);

    // Check slug uniqueness
    const existing = await this.dataSource.query(
      `SELECT id FROM ${s}.categories WHERE slug = $1`,
      [slug],
    );
    if (existing.length) throw new ConflictException(`Slug "${slug}" is already taken`);

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
    if (dto.slug !== undefined) { params.push(dto.slug); sets.push(`slug = $${params.length}`); }
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
