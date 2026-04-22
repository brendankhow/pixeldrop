'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { X, Upload, FileText, Star, FolderOpen, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Toggle } from '@/components/ui/Toggle';
import { Spinner } from '@/components/ui/Spinner';
import { createClient } from '@/lib/supabase/client';
import type { Product } from '@/types';

const MAX_IMAGES = 5;

type ImageSlot =
  | { type: 'existing'; url: string }
  | { type: 'new'; file: File; previewUrl: string }
  | { type: 'empty' };

interface ProductFormProps {
  mode: 'new' | 'edit';
  product?: Product;
}

export function ProductForm({ mode, product }: ProductFormProps) {
  const router = useRouter();

  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [category, setCategory] = useState<string>(product?.category ?? 'iphone');
  const [priceUsd, setPriceUsd] = useState(product ? (product.price / 100).toFixed(2) : '');
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [tags, setTags] = useState<string[]>(product?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [resolution, setResolution] = useState(product?.resolution ?? '');
  const [compatibleDevices, setCompatibleDevices] = useState<string[]>(product?.compatible_devices ?? []);
  const [deviceInput, setDeviceInput] = useState('');
  const [badge, setBadge] = useState<string>(product?.badge ?? '');
  const [originalPriceUsd, setOriginalPriceUsd] = useState(
    product?.original_price ? (product.original_price / 100).toFixed(2) : ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Deliverables: existing paths to keep + new files to upload
  const existingFilePaths = (): string[] => {
    if (mode === 'edit' && product) {
      if (product.file_paths?.length) return product.file_paths;
      if (product.file_path) return [product.file_path];
    }
    return [];
  };
  const [keepFilePaths, setKeepFilePaths] = useState<string[]>(existingFilePaths);
  const [newDeliverableFiles, setNewDeliverableFiles] = useState<File[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  // Unified image slots — slot[0] is always the cover/preview
  const initialSlots = (): ImageSlot[] => {
    const slots: ImageSlot[] = [];
    if (mode === 'edit' && product) {
      if (product.preview_image_url) slots.push({ type: 'existing', url: product.preview_image_url });
      (product.additional_images ?? []).forEach((url) => slots.push({ type: 'existing', url }));
    }
    while (slots.length < MAX_IMAGES) slots.push({ type: 'empty' });
    return slots.slice(0, MAX_IMAGES);
  };

  const [slots, setSlots] = useState<ImageSlot[]>(initialSlots);
  const imageInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function handleSlotFileChange(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setSlots((prev) => {
      const next = [...prev];
      const old = next[index];
      if (old.type === 'new') URL.revokeObjectURL(old.previewUrl);
      next[index] = { type: 'new', file, previewUrl };
      return next;
    });
    e.target.value = '';
  }

  function removeSlot(index: number) {
    setSlots((prev) => {
      const next = [...prev];
      const old = next[index];
      if (old.type === 'new') URL.revokeObjectURL(old.previewUrl);
      next.splice(index, 1);
      next.push({ type: 'empty' });
      return next;
    });
  }

  function setCover(index: number) {
    if (index === 0) return;
    setSlots((prev) => {
      const next = [...prev];
      const [cover] = next.splice(index, 1);
      next.unshift(cover);
      return next;
    });
  }

  function handleDeliverableFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setNewDeliverableFiles((prev) => [...prev, ...files]);
    e.target.value = '';
  }

  function removeNewDeliverable(index: number) {
    setNewDeliverableFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function removeKeepDeliverable(path: string) {
    setKeepFilePaths((prev) => prev.filter((p) => p !== path));
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const tag = tagInput.trim().replace(/,$/, '');
      if (tag && !tags.includes(tag)) setTags((prev) => [...prev, tag]);
      setTagInput('');
    }
  }

  function handleDeviceKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const device = deviceInput.trim().replace(/,$/, '');
      if (device && !compatibleDevices.includes(device)) setCompatibleDevices((prev) => [...prev, device]);
      setDeviceInput('');
    }
  }

  async function uploadFileDirect(bucket: string, file: File, storagePath?: string): Promise<string> {
    const filename = storagePath ?? file.name;
    const res = await fetch('/api/admin/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket, filename }),
    });
    if (!res.ok) {
      const { error } = await res.json();
      throw new Error(error ?? 'Failed to get upload URL');
    }
    const { path, token } = await res.json();
    const supabase = createClient();
    const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(path, token, file);
    if (error) throw new Error(`Upload failed: ${error.message}`);
    return path as string;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const filledSlots = slots.filter((s) => s.type !== 'empty');
    if (filledSlots.length === 0) {
      setError('At least one image is required');
      return;
    }

    const totalDeliverables = keepFilePaths.length + newDeliverableFiles.length;
    if (mode === 'new' && totalDeliverables === 0) {
      setError('At least one deliverable file is required');
      return;
    }

    setIsSubmitting(true);

    const coverSlot = slots[0];
    const additionalSlots = slots.slice(1).filter((s) => s.type !== 'empty');

    try {
      let previewImagePath: string | null = null;
      const additionalPaths: string[] = [];
      const newDeliverablePaths: string[] = [];

      if (coverSlot.type === 'new') {
        previewImagePath = await uploadFileDirect('product-previews', coverSlot.file);
      }
      for (const slot of additionalSlots) {
        if (slot.type === 'new') {
          additionalPaths.push(await uploadFileDirect('product-previews', slot.file));
        }
      }
      for (const file of newDeliverableFiles) {
        // Preserve folder structure via webkitRelativePath if available
        const storagePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        newDeliverablePaths.push(await uploadFileDirect('product-files', file, storagePath));
      }

      const formData = new FormData();
      formData.set('name', name);
      formData.set('description', description);
      formData.set('category', category);
      formData.set('price', priceUsd);
      formData.set('is_active', String(isActive));
      formData.set('tags', tags.join(','));
      formData.set('resolution', resolution);
      formData.set('compatible_devices', compatibleDevices.join(','));
      formData.set('badge', badge);
      formData.set('original_price', originalPriceUsd);

      if (previewImagePath) {
        formData.set('preview_image_path', previewImagePath);
      } else if (coverSlot.type === 'existing') {
        formData.set('keep_preview_url', coverSlot.url);
      }

      const keepAdditional: string[] = [];
      additionalSlots.forEach((slot) => {
        if (slot.type === 'existing') keepAdditional.push(slot.url);
      });
      formData.set('keep_additional_urls', JSON.stringify(keepAdditional));
      formData.set('new_additional_paths', JSON.stringify(additionalPaths));

      // Multi-file deliverables
      formData.set('keep_file_paths', JSON.stringify(keepFilePaths));
      formData.set('new_deliverable_paths', JSON.stringify(newDeliverablePaths));

      const url = mode === 'new' ? '/api/admin/products' : `/api/admin/products/${product!.id}`;
      const method = mode === 'new' ? 'POST' : 'PATCH';
      const res = await fetch(url, { method, body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save product');
      toast.success(mode === 'new' ? 'Product created!' : 'Product updated!');
      router.push('/admin/products');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl">

      <Input
        id="name"
        label="Product Name *"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Aurora Borealis — iPhone"
        required
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium text-fg">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Describe your product…"
          className="w-full rounded-lg bg-card border border-edge px-3 py-2.5 text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Select
          id="category"
          label="Category *"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="iphone">iPhone</option>
          <option value="desktop">Desktop</option>
          <option value="bundle">Bundle</option>
          <option value="other">Other</option>
        </Select>

        <Input
          id="price"
          label="Price (USD) *"
          type="number"
          min="0.50"
          step="0.01"
          value={priceUsd}
          onChange={(e) => setPriceUsd(e.target.value)}
          placeholder="4.99"
          required
        />
      </div>

      {/* Resolution */}
      <div className="space-y-1.5">
        <Input
          id="resolution"
          label="Resolution"
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          placeholder="e.g. 1320 × 2868"
        />
        <p className="text-xs text-fg-faint">Enter the pixel dimensions of the deliverable file</p>
      </div>

      {/* Compatible Devices */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-fg">Compatible Devices</label>
        <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-card border border-edge min-h-[52px]">
          {compatibleDevices.map((device) => (
            <span
              key={device}
              className="inline-flex items-center gap-1.5 bg-primary/20 border border-primary/30 text-[#A78BFA] rounded-full px-3 py-1 text-xs font-medium"
            >
              {device}
              <button
                type="button"
                onClick={() => setCompatibleDevices((p) => p.filter((d) => d !== device))}
                className="hover:text-white transition-colors"
                aria-label={`Remove ${device}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={deviceInput}
            onChange={(e) => setDeviceInput(e.target.value)}
            onKeyDown={handleDeviceKeyDown}
            placeholder={compatibleDevices.length === 0 ? 'iPhone 16 Pro Max, iPhone 15 Pro…' : ''}
            className="flex-1 min-w-[140px] bg-transparent text-sm text-fg placeholder:text-fg-faint focus:outline-none"
          />
        </div>
        <p className="text-xs text-fg-faint">Press Enter or comma to add a device. List the screens this wallpaper is optimised for.</p>
      </div>

      {/* Unified image grid */}
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-fg">
            Images {mode === 'new' ? '*' : ''}
          </label>
          <p className="text-xs text-fg-faint mt-0.5">
            First image is the cover shown on the store. Click <Star size={10} className="inline" /> to set any image as cover.
          </p>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {slots.map((slot, i) => (
            <div key={i} className="relative group">
              {slot.type !== 'empty' ? (
                <div className="relative aspect-square rounded-xl overflow-hidden border-2 border-edge">
                  <Image
                    src={slot.type === 'new' ? slot.previewUrl : slot.url}
                    alt={`Image ${i + 1}`}
                    fill
                    className="object-cover"
                    sizes="120px"
                  />
                  {i === 0 && (
                    <div className="absolute top-1 left-1 bg-primary rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                      <Star size={9} className="text-white fill-white" />
                      <span className="text-[9px] text-white font-semibold">Cover</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                    {i !== 0 && (
                      <button
                        type="button"
                        onClick={() => setCover(i)}
                        title="Set as cover"
                        className="bg-white/20 hover:bg-primary rounded-full p-1.5 transition-colors"
                      >
                        <Star size={12} className="text-white" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeSlot(i)}
                      title="Remove"
                      className="bg-white/20 hover:bg-red-500 rounded-full p-1.5 transition-colors"
                    >
                      <X size={12} className="text-white" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => imageInputRefs.current[i]?.click()}
                  className="w-full aspect-square rounded-xl border-2 border-dashed border-edge hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-1"
                >
                  <Upload size={16} className="text-fg-faint" />
                  {i === 0 && <span className="text-[10px] text-fg-faint">Cover</span>}
                </button>
              )}
              <input
                ref={(el) => { imageInputRefs.current[i] = el; }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleSlotFileChange(i, e)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Deliverable Files */}
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-fg">
            Deliverable Files {mode === 'new' ? '*' : '(add more or remove existing)'}
          </label>
          <p className="text-xs text-fg-faint mt-0.5">
            Upload individual files or entire folders. Customers receive download links for all files.
          </p>
        </div>

        {/* File list */}
        {(keepFilePaths.length > 0 || newDeliverableFiles.length > 0) && (
          <div className="space-y-2">
            {keepFilePaths.map((path) => (
              <div key={path} className="flex items-center gap-3 rounded-xl border border-edge bg-card px-4 py-3">
                <FileText size={18} className="text-fg-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-fg truncate">{path.split('/').pop()}</p>
                  <p className="text-xs text-fg-faint">Existing file</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeKeepDeliverable(path)}
                  className="text-fg-faint hover:text-red-400 transition-colors shrink-0"
                  title="Remove"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            {newDeliverableFiles.map((file, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                <FileText size={18} className="text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-fg truncate">
                    {(file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name}
                  </p>
                  <p className="text-xs text-fg-faint">{formatBytes(file.size)} · New</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeNewDeliverable(i)}
                  className="text-fg-faint hover:text-red-400 transition-colors shrink-0"
                  title="Remove"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-edge hover:border-primary/50 transition-colors px-4 py-3 text-sm text-fg-muted hover:text-fg"
          >
            <Plus size={15} />
            Add Files
          </button>
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-edge hover:border-primary/50 transition-colors px-4 py-3 text-sm text-fg-muted hover:text-fg"
          >
            <FolderOpen size={15} />
            Add Folder
          </button>
        </div>

        {/* Hidden inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleDeliverableFilesChange}
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error webkitdirectory is non-standard but widely supported
          webkitdirectory=""
          multiple
          className="hidden"
          onChange={handleDeliverableFilesChange}
        />
      </div>

      {/* Active toggle */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-edge">
        <div>
          <p className="text-sm font-medium text-fg">Active</p>
          <p className="text-xs text-fg-faint mt-0.5">Active products appear on the storefront</p>
        </div>
        <Toggle checked={isActive} onChange={setIsActive} />
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-fg">Tags</label>
        <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-card border border-edge min-h-[52px]">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 bg-primary/20 border border-primary/30 text-[#A78BFA] rounded-full px-3 py-1 text-xs font-medium"
            >
              {tag}
              <button type="button" onClick={() => setTags((p) => p.filter((t) => t !== tag))} className="hover:text-white transition-colors" aria-label={`Remove ${tag}`}>
                <X size={12} />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder={tags.length === 0 ? 'Type a tag and press Enter or comma' : ''}
            className="flex-1 min-w-[120px] bg-transparent text-sm text-fg placeholder:text-fg-faint focus:outline-none"
          />
        </div>
        <p className="text-xs text-fg-faint">Press Enter or comma to add a tag</p>
      </div>

      {/* ── Merchandising ─────────────────────────────────────────────────── */}
      <div className="space-y-5 pt-2 border-t border-edge">
        <h3 className="text-sm font-semibold text-fg-muted uppercase tracking-wide">Merchandising</h3>

        {/* Badge selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-fg">Product Badge</label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: '', label: 'None' },
              { value: 'new', label: '🆕 New' },
              { value: 'trending', label: '🔥 Trending' },
              { value: 'bestseller', label: '⭐ Bestseller' },
            ].map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setBadge(value)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  badge === value
                    ? 'bg-primary border-primary text-white'
                    : 'bg-card border-edge text-fg-muted hover:border-primary/50 hover:text-fg'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-fg-faint">Shown as an overlay badge on the product card</p>
        </div>

        {/* Original price (for sale pricing) */}
        <div className="space-y-1.5">
          <Input
            id="original_price"
            label="Original Price (USD) — optional"
            type="number"
            min="0.50"
            step="0.01"
            value={originalPriceUsd}
            onChange={(e) => setOriginalPriceUsd(e.target.value)}
            placeholder="e.g. 9.99"
          />
          <p className="text-xs text-fg-faint">
            If set, shows as a struck-through "was" price alongside the current sale price
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting}>
          {isSubmitting ? (
            <><Spinner size="sm" />{mode === 'new' ? 'Creating…' : 'Saving…'}</>
          ) : mode === 'new' ? 'Create Product' : 'Save Changes'}
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={() => router.push('/admin/products')} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
