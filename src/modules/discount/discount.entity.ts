// Discount entity — all DB operations use raw DataSource queries with tenant schemaName prefix.
export type DiscountType = 'PERCENTAGE' | 'FLAT';

export interface DiscountRow {
  id: string;
  code: string;
  type: DiscountType;
  value: number;
  min_order_amt: number;
  max_discount: number | null;
  usage_limit: number | null;
  used_count: number;
  valid_from: Date | null;
  valid_until: Date | null;
  is_active: boolean;
}
