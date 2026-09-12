// Delivery entity — all DB operations use raw DataSource queries with tenant schemaName prefix.
export type DeliveryStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'PICKED_UP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'FAILED';

export interface DeliveryRow {
  id: string;
  order_id: string;
  agent_id: string | null;
  status: DeliveryStatus;
  estimated_time: number | null; // minutes
  notes: string | null;
  assigned_at: Date | null;
  delivered_at: Date | null;
}
