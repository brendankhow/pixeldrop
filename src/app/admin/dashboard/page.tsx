import { createServiceClient } from '@/lib/supabase/server';
import { formatPrice } from '@/lib/utils';
import { RevenueChart } from '@/components/admin/RevenueChart';
import { CategoryChart } from '@/components/admin/CategoryChart';
import { TrendingUp, ShoppingBag, Users, Package } from 'lucide-react';
import type { Order, Product } from '@/types';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const supabase = createServiceClient();

  const [ordersResult, productsResult] = await Promise.all([
    supabase
      .from('orders')
      .select('*')
      .in('status', ['paid', 'delivered', 'refunded'])
      .order('created_at', { ascending: false }),
    supabase.from('products').select('id, category').eq('is_active', true),
  ]);

  const orders = (ordersResult.data ?? []) as Order[];
  const products = (productsResult.data ?? []) as Pick<Product, 'id' | 'category'>[];

  // Build productId → category map
  const productCategoryMap: Record<string, string> = {};
  products.forEach((p) => {
    productCategoryMap[p.id] = p.category;
  });

  // Metrics
  const paidOrders = orders.filter((o) => o.status !== 'refunded');
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.amount_total, 0);
  const totalOrders = orders.length;
  const uniqueCustomers = new Set(orders.map((o) => o.customer_email)).size;

  // Top products
  const productSales: Record<string, { name: string; revenue: number; count: number }> = {};
  paidOrders.forEach((order) => {
    order.products.forEach((item) => {
      if (!productSales[item.id]) {
        productSales[item.id] = { name: item.name, revenue: 0, count: 0 };
      }
      productSales[item.id].revenue += item.price;
      productSales[item.id].count += 1;
    });
  });
  const topProducts = Object.values(productSales)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const metrics = [
    {
      label: 'Total Revenue',
      value: formatPrice(totalRevenue),
      icon: TrendingUp,
      color: 'text-emerald-400',
      bg: 'bg-emerald-400/10',
    },
    {
      label: 'Total Orders',
      value: totalOrders.toString(),
      icon: ShoppingBag,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
    },
    {
      label: 'Customers',
      value: uniqueCustomers.toString(),
      icon: Users,
      color: 'text-purple-400',
      bg: 'bg-purple-400/10',
    },
    {
      label: 'Active Products',
      value: products.length.toString(),
      icon: Package,
      color: 'text-amber-400',
      bg: 'bg-amber-400/10',
    },
  ];

  const isEmpty = orders.length === 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#EDEDED]">Dashboard</h1>
        <p className="text-sm text-[#9CA3AF] mt-1">
          Welcome back — here's what's happening with PixelDropp.
        </p>
      </div>

      {/* Metrics cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="bg-[#111111] border border-[#1F1F1F] rounded-2xl p-5 flex flex-col gap-3"
          >
            <div className={`w-9 h-9 rounded-lg ${m.bg} flex items-center justify-center`}>
              <m.icon size={18} className={m.color} />
            </div>
            <div>
              <p className="text-xs text-[#6B7280] font-medium">{m.label}</p>
              <p className="text-2xl font-bold text-[#EDEDED] mt-0.5">{m.value}</p>
            </div>
          </div>
        ))}
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border border-[#1F1F1F] rounded-2xl">
          <TrendingUp size={48} className="text-[#2D2D2D] mb-4" />
          <p className="text-[#9CA3AF] font-medium">No sales yet.</p>
          <p className="text-[#6B7280] text-sm mt-1">
            Share your products on X to get started! 🚀
          </p>
        </div>
      ) : (
        <>
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RevenueChart orders={orders} />
            <CategoryChart orders={orders} productCategoryMap={productCategoryMap} />
          </div>

          {/* Top products */}
          <div className="bg-[#111111] border border-[#1F1F1F] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#1F1F1F]">
              <h2 className="text-base font-semibold text-[#EDEDED]">Top Products</h2>
            </div>
            {topProducts.length === 0 ? (
              <p className="px-6 py-8 text-sm text-[#6B7280]">No product data yet.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1F1F1F] bg-[#0D0D0D]">
                    {['Product', 'Units Sold', 'Revenue'].map((h) => (
                      <th
                        key={h}
                        className="px-6 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((p, i) => (
                    <tr
                      key={i}
                      className="border-b border-[#1F1F1F] last:border-0 hover:bg-[#0D0D0D] transition-colors"
                    >
                      <td className="px-6 py-3 text-sm text-[#EDEDED] font-medium">{p.name}</td>
                      <td className="px-6 py-3 text-sm text-[#9CA3AF]">{p.count}</td>
                      <td className="px-6 py-3 text-sm text-[#EDEDED] font-medium">
                        {formatPrice(p.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
