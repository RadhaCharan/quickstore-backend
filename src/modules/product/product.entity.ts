// Product entity is declared here for type/DTO reference.
// All DB operations use raw DataSource queries with the tenant's schemaName prefix
// because TypeORM does not support truly dynamic schemas per-request.

export interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  price: number;
  mrp: number | null;
  stock: number;
  unit: string | null;
  category_id: string | null;
  is_active: boolean;
  images: string[];
  created_at: Date;
  updated_at: Date;
}
