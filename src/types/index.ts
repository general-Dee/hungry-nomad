export type ProductCategory = 'fast_food' | 'regular' | 'chinese' | 'icecream' | 'beverages';

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category: ProductCategory;
  subcategory?: string;
  image_url: string;
  created_at: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Order {
  id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  delivery_lga: string;
  delivery_fee: number;
  total_amount: number;
  payment_reference: string | null;
  status: 'pending' | 'paid' | 'failed' | 'delivered';
  created_at: string;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  fbclid?: string | null;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  price_at_time: number;
}

export interface DeliveryZone {
  id: number;
  lga_name: string;
  fee: number;
}