// DeliveryAgent entity — all DB operations use raw DataSource queries with tenant schemaName prefix.
export interface DeliveryAgentRow {
  id: string;
  name: string;
  phone: string;
  is_active: boolean;
}
