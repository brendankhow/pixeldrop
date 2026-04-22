'use client';

import { useState } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Download, Check, PackageOpen } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import type { CropState } from './FormatCard';
import { DEFAULT_CROP } from './FormatCard';
import type { FormatConfig } from '@/lib/playground/formats';
import { renderToBlob } from '@/lib/playground/formats';

interface BatchDownloadButtonProps {
  sourceImage: HTMLImageElement | null;
  formats: FormatConfig[];
  cropStates: Record<string, CropState>;
  zipFilename: string;
  label: string;
  /** When true, renders as the full-width "Download Everything" style */
  prominent?: boolean;
  /** Optional prefix for individual PNG filenames inside the ZIP. Defaults to "pixeldrop". */
  filenamePrefix?: string;
}

type BatchStatus = 'idle' | 'rendering' | 'done';

export function BatchDownloadButton({
  sourceImage,
  formats,
  cropStates,
  zipFilename,
  label,
  prominent = false,
  filenamePrefix = 'pixeldrop',
}: BatchDownloadButtonProps) {
  const [status, setStatus] = useState<BatchStatus>('idle');
  const [current, setCurrent] = useState(0);

  const total = formats.length;
  const disabled = !sourceImage || status === 'rendering';

  async function handleClick() {
    if (!sourceImage || status === 'rendering') return;

    setStatus('rendering');
    setCurrent(0);

    try {
      const zip = new JSZip();

      for (let i = 0; i < formats.length; i++) {
        const fmt = formats[i];
        setCurrent(i + 1);

        const cropState: CropState = cropStates[fmt.slug] ?? DEFAULT_CROP;
        const blob = await renderToBlob(sourceImage, fmt.w, fmt.h, cropState);
        zip.file(`${filenamePrefix}-${fmt.slug}.png`, blob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, zipFilename);

      setStatus('done');
      setTimeout(() => { setStatus('idle'); setCurrent(0); }, 3000);
    } catch {
      setStatus('idle');
      setCurrent(0);
    }
  }

  // ── Button content ──────────────────────────────────────────────────────────

  function ButtonContent() {
    if (status === 'rendering') {
      return (
        <>
          <Spinner size="sm" className="border-white border-t-transparent" />
          Rendering {current}/{total}…
        </>
      );
    }
    if (status === 'done') {
      return <><Check size={14} />Downloaded</>;
    }
    if (prominent) {
      return <><PackageOpen size={15} />{label}</>;
    }
    return <><Download size={13} />{label}</>;
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (prominent) {
    return (
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled}
          title={!sourceImage ? 'Upload an image first' : undefined}
          className={`inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-sm font-semibold min-h-[52px] transition-all ${
            status === 'done'
              ? 'bg-emerald-600 text-white'
              : status === 'rendering'
              ? 'bg-[#5B21B6]/60 text-white cursor-wait'
              : disabled
              ? 'bg-[#1A1A1A] text-[#4B5563] border border-[#2D2D2D] cursor-not-allowed'
              : 'bg-[#5B21B6] hover:bg-[#6D28D9] active:bg-[#4C1D95] text-white border border-[#7C3AED]'
          }`}
        >
          <ButtonContent />
        </button>
        {!sourceImage && (
          <p className="text-xs text-[#4B5563]">Upload an image first</p>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-xs font-semibold min-h-[40px] transition-all border ${
        status === 'done'
          ? 'bg-emerald-600/20 border-emerald-600/40 text-emerald-400'
          : status === 'rendering'
          ? 'bg-[#5B21B6]/20 border-[#5B21B6]/30 text-[#A78BFA] cursor-wait'
          : disabled
          ? 'bg-transparent border-[#2D2D2D] text-[#4B5563] cursor-not-allowed'
          : 'bg-[#5B21B6]/10 border-[#5B21B6]/30 text-[#A78BFA] hover:bg-[#5B21B6]/20 hover:border-[#5B21B6]/50'
      }`}
    >
      <ButtonContent />
    </button>
  );
}
