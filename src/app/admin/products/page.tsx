import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/server';
import { ProductsTable } from '@/components/admin/ProductsTable';
import type { Product, Order } from '@/types';

export const dynamic = 'force-dynamic';

export default async function AdminProductsPage() {
  const supabase = createServiceClient();

  const [productsResult, ordersResult, subscribersResult] = await Promise.all([
    supabase.from('products').select('*').order('created_at', { ascending: false }),
    supabase
      .from('orders')
      .select('products')
      .in('status', ['paid', 'delivered']),
    supabase.from('email_subscribers').select('id', { count: 'exact', head: true }),
  ]);

  const products = (productsResult.data ?? []) as Product[];
  const subscriberCount = subscribersResult.count ?? 0;

  // Compute sales count per product from JSONB orders
  const salesMap: Record<string, number> = {};
  (ordersResult.data ?? []).forEach((order) => {
    const items = order.products as Array<{ id: string }>;
    items?.forEach((p) => {
      salesMap[p.id] = (salesMap[p.id] ?? 0) + 1;
    });
  });

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#EDEDED]">Products</h1>
          <p className="text-sm text-[#9CA3AF] mt-1">
            {products.length} product{products.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex items-center gap-2 bg-[#5B21B6] hover:bg-[#6D28D9] text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors min-h-[44px]"
        >
          <Plus size={16} />
          Add New Product
        </Link>
      </div>

      <ProductsTable products={products} salesMap={salesMap} subscriberCount={subscriberCount} />
    </div>
  );
}
