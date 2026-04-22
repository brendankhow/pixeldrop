export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number; // in cents
  category: 'iphone' | 'desktop' | 'bundle' | 'other';
  preview_image_url: string | null;
  additional_images: string[];
  file_path: string;
  file_paths: string[];
  is_active: boolean;
  tags: string[];
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  resolution: string | null;
  compatible_devices: string[] | null;
  badge: string | null;
  original_price: number | null;
  last_blast_at: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  stripe_session_id: string;
  stripe_payment_intent_id: string | null;
  customer_email: string;
  amount_total: number; // in cents
  currency: string;
  status: 'pending' | 'paid' | 'delivered' | 'refunded' | 'failed';
  products: Array<{ id: string; name: string; price: number }>;
  email_sent_at: string | null;
  created_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface SocialQueueItem {
  id: string;
  product_id: string;
  platform: 'instagram' | 'twitter';
  format_slug: string;
  caption: string | null;
  status: 'draft' | 'posted';
  posted_at: string | null;
  created_at: string;
  product?: { name: string; preview_image_url: string | null };
}
