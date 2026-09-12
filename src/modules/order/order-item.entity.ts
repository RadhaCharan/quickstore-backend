// OrderItem entity — raw DataSource queries only.
export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string; // snapshot at time of order
  price: number;
  quantity: number;
  subtotal: number;
}
