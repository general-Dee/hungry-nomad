export type ProductCategory = 'fast_food' | 'regular' | 'chinese';

export interface Product {
  id: number;        // Now number, not string
  name: string;
  description: string;
  price: number;
  category: ProductCategory;
  image_url: string;
  created_at: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Order {
  id: number;        // number
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  total_amount: number;
  payment_reference: string | null;
  status: 'pending' | 'paid' | 'failed' | 'delivered';
  created_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  price_at_time: number;
}

export interface Product {
  id: number;        // number, not string
  // ... rest
}
export interface CartItem extends Product {
  quantity: number;
}