'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, RotateCcw, Check } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CropState {
  offsetX: number; // pan in full-resolution target pixels (0 = centred)
  offsetY: number;
  scale: number;   // zoom multiplier (1 = cover-fill, ≥ 1)
}

export const DEFAULT_CROP: CropState = { offsetX: 0, offsetY: 0, scale: 1 };

// ── Constants ──────────────────────────────────────────────────────────────────

const MAX_PREVIEW_W = 260;
const MAX_PREVIEW_H = 380;

// ── Component ──────────────────────────────────────────────────────────────────

interface FormatCardProps {
  sourceImage: HTMLImageElement | null;
  targetWidth: number;
  targetHeight: number;
  label: string;
  slug: string;
  cropState: CropState;
  onCropChange: (slug: string, state: CropState) => void;
}

export function FormatCard({
  sourceImage,
  targetWidth,
  targetHeight,
  label,
  slug,
  cropState,
  onCropChange,
}: FormatCardProps) {
  // ── Derived preview dimensions (stable per card instance) ──────────────────
  const previewScale = Math.min(MAX_PREVIEW_W / targetWidth, MAX_PREVIEW_H / targetHeight);
  const previewW = Math.round(targetWidth * previewScale);
  const previewH = Math.round(targetHeight * previewScale);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Keep mutable refs current so event-listener closures never go stale
  const sourceImageRef = useRef(sourceImage);
  useEffect(() => { sourceImageRef.current = sourceImage; }, [sourceImage]);

  const cropStateRef = useRef(cropState);
  useEffect(() => { cropStateRef.current = cropState; }, [cropState]);

  const onCropChangeRef = useRef(onCropChange);
  useEffect(() => { onCropChangeRef.current = onCropChange; }, [onCropChange]);

  const isDragging = useRef(false);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, offsetX: 0, offsetY: 0 });

  // ── Download state ─────────────────────────────────────────────────────────
  type DownloadState = 'idle' | 'rendering' | 'done';
  const [dlState, setDlState] = useState<DownloadState>('idle');

  // ── Canvas render ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, previewW, previewH);

    if (!sourceImage) {
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, previewW, previewH);
      return;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // coverScale: scale so source exactly covers target at zoom=1
    const coverScale = Math.max(
      targetWidth / sourceImage.naturalWidth,
      targetHeight / sourceImage.naturalHeight,
    );
    const totalScale = coverScale * cropState.scale * previewScale;
    const drawnW = sourceImage.naturalWidth * totalScale;
    const drawnH = sourceImage.naturalHeight * totalScale;
    const drawX = (previewW - drawnW) / 2 + cropState.offsetX * previewScale;
    const drawY = (previewH - drawnH) / 2 + cropState.offsetY * previewScale;

    ctx.drawImage(sourceImage, drawX, drawY, drawnW, drawnH);
  }, [sourceImage, cropState, previewW, previewH, previewScale, targetWidth, targetHeight]);

  // ── Global mouse drag listeners (stable closure via refs) ──────────────────
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isDragging.current) return;
      const src = sourceImageRef.current;
      if (!src) return;

      const state = cropStateRef.current;

      // Delta in target-resolution pixels
      const dx = (e.clientX - dragStart.current.mouseX) / previewScale;
      const dy = (e.clientY - dragStart.current.mouseY) / previewScale;

      const rawX = dragStart.current.offsetX + dx;
      const rawY = dragStart.current.offsetY + dy;

      // Clamp so the image always covers the canvas
      const coverScale = Math.max(targetWidth / src.naturalWidth, targetHeight / src.naturalHeight);
      const drawnW = src.naturalWidth * coverScale * state.scale;
      const drawnH = src.naturalHeight * coverScale * state.scale;
      const maxX = Math.max(0, (drawnW - targetWidth) / 2);
      const maxY = Math.max(0, (drawnH - targetHeight) / 2);

      onCropChangeRef.current(slug, {
        ...state,
        offsetX: Math.max(-maxX, Math.min(maxX, rawX)),
        offsetY: Math.max(-maxY, Math.min(maxY, rawY)),
      });
    }

    function onMouseUp() {
      isDragging.current = false;
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    // previewScale, targetWidth, targetHeight, slug are all stable per instance
  }, [previewScale, targetWidth, targetHeight, slug]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!sourceImage) return;
    isDragging.current = true;
    dragStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      offsetX: cropState.offsetX,
      offsetY: cropState.offsetY,
    };
    e.preventDefault();
  }

  function handleZoomChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!sourceImage) return;
    const newScale = parseFloat(e.target.value);

    // Re-clamp offsets for the new scale
    const coverScale = Math.max(
      targetWidth / sourceImage.naturalWidth,
      targetHeight / sourceImage.naturalHeight,
    );
    const drawnW = sourceImage.naturalWidth * coverScale * newScale;
    const drawnH = sourceImage.naturalHeight * coverScale * newScale;
    const maxX = Math.max(0, (drawnW - targetWidth) / 2);
    const maxY = Math.max(0, (drawnH - targetHeight) / 2);

    onCropChange(slug, {
      scale: newScale,
      offsetX: Math.max(-maxX, Math.min(maxX, cropState.offsetX)),
      offsetY: Math.max(-maxY, Math.min(maxY, cropState.offsetY)),
    });
  }

  function handleReset() {
    onCropChange(slug, DEFAULT_CROP);
  }

  function handleDownload() {
    if (!sourceImage) return;
    setDlState('rendering');

    // Defer heavy work so React can paint the spinner first
    setTimeout(() => {
      try {
        const offscreen = document.createElement('canvas');
        offscreen.width = targetWidth;
        offscreen.height = targetHeight;
        const ctx = offscreen.getContext('2d')!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        const cs = cropStateRef.current;
        const coverScale = Math.max(
          targetWidth / sourceImage.naturalWidth,
          targetHeight / sourceImage.naturalHeight,
        );
        const totalScale = coverScale * cs.scale;
        const drawnW = sourceImage.naturalWidth * totalScale;
        const drawnH = sourceImage.naturalHeight * totalScale;
        const drawX = (targetWidth - drawnW) / 2 + cs.offsetX;
        const drawY = (targetHeight - drawnH) / 2 + cs.offsetY;
        ctx.drawImage(sourceImage, drawX, drawY, drawnW, drawnH);

        offscreen.toBlob(
          (blob) => {
            if (!blob) { setDlState('idle'); return; }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pixeldrop-${slug}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setDlState('done');
            setTimeout(() => setDlState('idle'), 2500);
          },
          'image/png',
          1.0,
        );
      } catch {
        setDlState('idle');
      }
    }, 50);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3 bg-[#111111] border border-[#1F1F1F] rounded-2xl p-4">

      {/* Preview canvas */}
      <div
        className="relative mx-auto rounded-xl overflow-hidden border border-[#2D2D2D]"
        style={{ width: previewW, height: previewH, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)' }}
      >
        <canvas
          ref={canvasRef}
          width={previewW}
          height={previewH}
          onMouseDown={handleMouseDown}
          className={`block ${sourceImage ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
          style={{ width: previewW, height: previewH }}
        />

        {/* No-image overlay */}
        {!sourceImage && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0D0D0D]/80">
            <p className="text-xs text-[#4B5563] text-center px-4 leading-relaxed">
              Upload an image<br />to preview
            </p>
          </div>
        )}
      </div>

      {/* Label */}
      <p className="text-[11px] font-medium text-[#9CA3AF] text-center leading-snug">{label}</p>

      {/* Zoom slider */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[#6B7280] w-5 text-right shrink-0">1×</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={cropState.scale}
          onChange={handleZoomChange}
          disabled={!sourceImage}
          className="flex-1 h-1.5 accent-[#5B21B6] cursor-pointer disabled:opacity-30 disabled:cursor-default"
        />
        <span className="text-[10px] text-[#6B7280] w-5 shrink-0">3×</span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleReset}
          disabled={!sourceImage}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#9CA3AF] hover:text-[#EDEDED] hover:bg-[#1A1A1A] border border-[#2D2D2D] hover:border-[#3D3D3D] transition-colors disabled:opacity-30 disabled:pointer-events-none whitespace-nowrap"
        >
          <RotateCcw size={11} />
          Reset
        </button>

        <button
          type="button"
          onClick={handleDownload}
          disabled={!sourceImage || dlState === 'rendering'}
          className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            dlState === 'done'
              ? 'bg-emerald-600 text-white'
              : dlState === 'rendering'
              ? 'bg-[#5B21B6]/60 text-white cursor-wait'
              : 'bg-[#5B21B6] hover:bg-[#6D28D9] text-white disabled:opacity-30 disabled:pointer-events-none'
          }`}
        >
          {dlState === 'rendering' ? (
            <><Spinner size="sm" className="border-white border-t-transparent" />Rendering…</>
          ) : dlState === 'done' ? (
            <><Check size={12} />Done</>
          ) : (
            <><Download size={12} />Download PNG</>
          )}
        </button>
      </div>
    </div>
  );
}
