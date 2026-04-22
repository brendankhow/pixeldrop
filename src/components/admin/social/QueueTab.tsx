'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Check, Trash2, Inbox } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import type { SocialQueueItem } from '@/types';

type StatusFilter = 'draft' | 'posted';

function formatTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  twitter: 'X / Twitter',
};

interface QueueTabProps {
  refreshKey: number;
}

export function QueueTab({ refreshKey }: QueueTabProps) {
  const [items, setItems] = useState<SocialQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('draft');
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function fetchQueue() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/social-queue');
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchQueue(); }, [refreshKey]);

  async function handleMarkPosted(id: string) {
    setMarkingId(id);
    try {
      const res = await fetch(`/api/admin/social-queue/${id}`, { method: 'PATCH' });
      if (!res.ok) return;
      setItems((prev) => prev.map((item) =>
        item.id === id
          ? { ...item, status: 'posted', posted_at: new Date().toISOString() }
          : item
      ));
    } finally {
      setMarkingId(null);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/social-queue/${id}`, { method: 'DELETE' });
      if (!res.ok) return;
      setItems((prev) => prev.filter((item) => item.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  const drafts = items.filter((i) => i.status === 'draft');
  const posted = items.filter((i) => i.status === 'posted');
  const visible = filter === 'draft' ? drafts : posted;

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-[#111111] border border-[#1F1F1F] rounded-xl p-1 w-fit">
        {(['draft', 'posted'] as StatusFilter[]).map((s) => {
          const count = s === 'draft' ? drafts.length : posted.length;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                filter === s
                  ? 'bg-[#5B21B6] text-white'
                  : 'text-[#9CA3AF] hover:text-[#EDEDED] hover:bg-[#1A1A1A]'
              }`}
            >
              {s === 'draft' ? 'Draft' : 'Posted'}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                filter === s ? 'bg-white/20' : 'bg-[#2D2D2D]'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[#6B7280] py-8 justify-center">
          <Spinner size="sm" />
          Loading queue…
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-[#1F1F1F] rounded-2xl">
          <Inbox size={36} className="text-[#2D2D2D] mb-3" />
          <p className="text-sm text-[#6B7280]">No {filter} items</p>
          {filter === 'draft' && (
            <p className="text-xs text-[#4B5563] mt-1">Generate captions and save them to your queue</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((item) => (
            <div
              key={item.id}
              className="bg-[#111111] border border-[#1F1F1F] rounded-2xl p-4 flex gap-4"
            >
              {/* Thumbnail */}
              <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-[#1a1a1a] shrink-0">
                {item.product?.preview_image_url ? (
                  <Image
                    src={item.product.preview_image_url}
                    alt={item.product.name ?? ''}
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                ) : (
                  <div className="w-full h-full bg-[#2D2D2D]" />
                )}
              </div>

              {/* Body */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-[#EDEDED] truncate">
                    {item.product?.name ?? 'Unknown product'}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a1a1a] border border-[#2D2D2D] text-[#9CA3AF]">
                    {PLATFORM_LABEL[item.platform] ?? item.platform}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a1a1a] border border-[#2D2D2D] text-[#9CA3AF]">
                    {item.format_slug}
                  </span>
                </div>
                {item.caption && (
                  <p className="text-xs text-[#6B7280] line-clamp-2 leading-relaxed">{item.caption}</p>
                )}
                <p className="text-[10px] text-[#4B5563]">
                  {item.status === 'posted' && item.posted_at
                    ? `Posted ${formatTimeAgo(item.posted_at)}`
                    : `Added ${formatTimeAgo(item.created_at)}`}
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1.5 shrink-0">
                {item.status === 'draft' && (
                  <button
                    type="button"
                    onClick={() => handleMarkPosted(item.id)}
                    disabled={markingId === item.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/10 border border-emerald-600/30 text-emerald-400 hover:bg-emerald-600/20 transition-colors disabled:opacity-50"
                  >
                    {markingId === item.id ? <Spinner size="sm" /> : <Check size={11} />}
                    Posted
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  disabled={deletingId === item.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#9CA3AF] hover:text-red-400 hover:bg-red-500/10 border border-[#2D2D2D] hover:border-red-500/30 transition-colors disabled:opacity-50"
                >
                  {deletingId === item.id ? <Spinner size="sm" /> : <Trash2 size={11} />}
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
