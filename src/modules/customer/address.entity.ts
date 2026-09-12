// Address entity — all DB operations use raw DataSource queries with tenant schemaName prefix.
export interface AddressRow {
  id: string;
  customer_id: string;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string | null;
  pincode: string | null;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
}
