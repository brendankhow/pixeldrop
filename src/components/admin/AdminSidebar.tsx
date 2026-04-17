'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  Package,
  Receipt,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

const navItems = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Products', href: '/admin/products', icon: Package },
  { label: 'Orders', href: '/admin/orders', icon: Receipt },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  }

  const NavLinks = () => (
    <nav className="flex flex-col gap-1">
      {navItems.map(({ label, href, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px]',
              active
                ? 'bg-[#5B21B6]/20 text-[#A78BFA] border border-[#5B21B6]/30'
                : 'text-[#9CA3AF] hover:text-[#EDEDED] hover:bg-[#1A1A1A]'
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* ── Desktop sidebar ───────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 bg-[#0A0A0A] border-r border-[#1F1F1F] min-h-screen sticky top-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[#1F1F1F]">
          <span className="text-sm font-bold text-[#EDEDED]">
            <span className="text-[#5B21B6]">✦</span> PixelDropp Admin
          </span>
        </div>

        {/* Nav */}
        <div className="flex-1 p-3">
          <NavLinks />
        </div>

        {/* Sign out */}
        <div className="p-3 border-t border-[#1F1F1F]">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-[#9CA3AF] hover:text-red-400 hover:bg-red-500/10 transition-colors min-h-[44px]"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar ────────────────────────────────────── */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#0A0A0A] border-b border-[#1F1F1F] sticky top-0 z-30">
        <span className="text-sm font-bold text-[#EDEDED]">
          <span className="text-[#5B21B6]">✦</span> PixelDropp Admin
        </span>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg text-[#9CA3AF] hover:text-[#EDEDED] hover:bg-[#1A1A1A] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* ── Mobile drawer overlay ──────────────────────────────── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <div className="relative w-64 bg-[#0A0A0A] border-r border-[#1F1F1F] flex flex-col z-50">
            <div className="flex items-center justify-between px-4 py-4 border-b border-[#1F1F1F]">
              <span className="text-sm font-bold text-[#EDEDED]">
                <span className="text-[#5B21B6]">✦</span> PixelDropp Admin
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#EDEDED] hover:bg-[#1A1A1A] transition-colors"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 p-3">
              <NavLinks />
            </div>
            <div className="p-3 border-t border-[#1F1F1F]">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-[#9CA3AF] hover:text-red-400 hover:bg-red-500/10 transition-colors min-h-[44px]"
              >
                <LogOut size={18} />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
