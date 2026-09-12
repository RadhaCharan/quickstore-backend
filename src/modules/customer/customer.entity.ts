// Customer entity — all DB operations use raw DataSource queries with tenant schemaName prefix.
export interface CustomerRow {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  created_at: Date;
}
