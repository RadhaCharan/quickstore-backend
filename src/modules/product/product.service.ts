import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { CategoryService } from '../category/category.service';

// Minimal CSV parser (handles quoted fields, escaped quotes, and CRLF/LF) — good enough
// for the simple name/description/price/mrp/stock/unit/category template we hand out.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const endField = () => { row.push(field); field = ''; };
  const endRow = () => { endField(); rows.push(row); row = []; };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      endField();
    } else if (c === '\r') {
      // skip — \n right after will end the row
    } else if (c === '\n') {
      endRow();
    } else {
      field += c;
    }
  }
  if (field.length || row.length) endRow();

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

@Injectable()
export class ProductService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly categoryService: CategoryService,
  ) {}

  // Allowlist only — sortBy is user input and must never be interpolated into SQL directly.
  private static readonly SORT_COLUMNS: Record<string, string> = {
    name: 'p.name',
    price: 'p.price',
    mrp: 'p.mrp',
    stock: 'p.stock',
    status: 'p.is_active',
    category: 'c.name',
    createdAt: 'p.created_at',
  };

  async findAll(
    schemaName: string,
    page = 1,
    limit = 20,
    search?: string,
    categoryId?: string,
    sortBy?: string,
    sortDir?: 'asc' | 'desc',
  ) {
    const offset = (page - 1) * limit;
    const s = `"${schemaName}"`;
    const params: any[] = [`%${search ?? ''}%`];
    let whereExtra = '';
    if (categoryId) {
      params.push(categoryId);
      whereExtra = `AND p.category_id = $${params.length}`;
    }

    const orderCol = ProductService.SORT_COLUMNS[sortBy ?? ''] ?? 'p.created_at';
    const dir = sortDir === 'asc' ? 'ASC' : 'DESC';

    params.push(limit, offset);
    const rows = await this.dataSource.query(
      `SELECT p.*, c.name as category_name
       FROM ${s}.products p
       LEFT JOIN ${s}.categories c ON c.id = p.category_id
       WHERE p.is_active = true AND p.name ILIKE $1
       ${whereExtra}
       ORDER BY ${orderCol} ${dir} NULLS LAST, p.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const countParams = categoryId ? [`%${search ?? ''}%`, categoryId] : [`%${search ?? ''}%`];
    const [{ count }] = await this.dataSource.query(
      `SELECT COUNT(*) FROM ${s}.products p WHERE p.is_active = true AND p.name ILIKE $1 ${whereExtra}`,
      countParams,
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

  async bulkImport(schemaName: string, csvText: string) {
    const s = `"${schemaName}"`;
    const rows = parseCsv(csvText);
    if (!rows.length) throw new BadRequestException('The CSV file is empty');

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const col = (name: string) => header.indexOf(name);
    const iName = col('name');
    const iDesc = col('description');
    const iPrice = col('price');
    const iMrp = col('mrp');
    const iStock = col('stock');
    const iUnit = col('unit');
    const iCategory = col('category');

    if (iName === -1 || iPrice === -1 || iStock === -1) {
      throw new BadRequestException('CSV must include at least "name", "price" and "stock" columns — download the sample template to see the expected format');
    }

    // Resolve category names -> ids once, so the file can reference categories by name.
    const categories = await this.dataSource.query(
      `SELECT id, name FROM ${s}.categories WHERE is_active = true`,
    );
    const categoryIdByName = new Map<string, string>(
      categories.map((c: any) => [String(c.name).trim().toLowerCase(), c.id]),
    );

    let created = 0;
    let categoriesCreated = 0;
    const skipped: { row: number; reason: string }[] = [];

    for (let r = 1; r < rows.length; r++) {
      const cols = rows[r];
      const name = cols[iName]?.trim();
      const price = Number(cols[iPrice]);
      const stock = Number(cols[iStock]);

      if (!name || !Number.isFinite(price) || !Number.isFinite(stock)) {
        skipped.push({ row: r + 1, reason: 'Missing or invalid name, price or stock' });
        continue;
      }

      const mrpRaw = iMrp > -1 ? cols[iMrp]?.trim() : '';
      const mrp = mrpRaw ? Number(mrpRaw) : null;
      const unit = iUnit > -1 ? (cols[iUnit]?.trim() || null) : null;
      const categoryName = iCategory > -1 ? cols[iCategory]?.trim() : '';
      const description = iDesc > -1 ? (cols[iDesc]?.trim() || null) : null;

      let categoryId: string | null = null;
      if (categoryName) {
        const key = categoryName.toLowerCase();
        categoryId = categoryIdByName.get(key) ?? null;
        if (!categoryId) {
          // First time this file mentions this category — create it so the product isn't
          // silently left uncategorized, and reuse it for every later row with the same name.
          const newCategory = await this.categoryService.create(schemaName, { name: categoryName });
          categoryId = newCategory.id;
          categoryIdByName.set(key, categoryId);
          categoriesCreated++;
        }
      }

      await this.dataSource.query(
        `INSERT INTO ${s}.products (name, description, price, mrp, stock, unit, category_id, images)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'{}')`,
        [name, description, price, mrp, stock, unit, categoryId],
      );
      created++;
    }

    return { created, categoriesCreated, skipped, totalRows: rows.length - 1 };
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
