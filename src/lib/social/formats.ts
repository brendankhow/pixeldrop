import type { FormatConfig } from '@/lib/playground/formats';

export const INSTAGRAM_FORMATS: FormatConfig[] = [
  { slug: 'ig-square',   label: 'Instagram Square · 1080 × 1080',   w: 1080, h: 1080 },
  { slug: 'ig-portrait', label: 'Instagram Portrait · 1080 × 1350',  w: 1080, h: 1350 },
  { slug: 'ig-story',    label: 'Instagram Story · 1080 × 1920',     w: 1080, h: 1920 },
];

export const TWITTER_FORMATS: FormatConfig[] = [
  { slug: 'x-card',   label: 'X / Twitter Card · 1200 × 675',    w: 1200, h: 675  },
  { slug: 'x-square', label: 'X / Twitter Square · 1080 × 1080', w: 1080, h: 1080 },
];

export const ALL_SOCIAL_FORMATS: FormatConfig[] = [
  ...INSTAGRAM_FORMATS,
  ...TWITTER_FORMATS,
];
