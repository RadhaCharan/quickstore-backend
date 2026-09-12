// Order entity — all DB operations use raw DataSource queries with tenant schemaName prefix.
export type OrderStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentMode = 'RAZORPAY' | 'COD';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface OrderRow {
  id: string;
  order_number: string;
  customer_id: string;
  address_id: string | null;
  status: OrderStatus;
  subtotal: number;
  discount_amt: number;
  delivery_fee: number;
  total: number;
  payment_mode: PaymentMode;
  payment_status: PaymentStatus;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}
