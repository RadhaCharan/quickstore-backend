// Category entity — all DB operations use raw DataSource queries with tenant schemaName prefix.
export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}
