import * as React from 'react';
import { cn } from '../lib/cn';

/**
 * BrandMark — the single IPRS brand component consumed by web + dashboard.
 *
 * - `mark`: shield-mark crop on transparency. Safe on ANY background.
 * - `lockup`: full lockup (shield + white `IPRS` + tagline). DARK surfaces only —
 *   the wordmark is white and invisible on light backgrounds.
 *
 * Assets live in each app's `public/brand/` (Next serves per-app `public`).
 * Plain `<img>` with explicit dimensions (no CLS, no `next` dependency in `@fleek/ui`).
 */
export type BrandMarkVariant = 'mark' | 'lockup';

const SOURCES: Record<BrandMarkVariant, { src: string; width: number; height: number }> = {
  mark: { src: '/brand/mark.png', width: 512, height: 512 },
  lockup: { src: '/brand/lockup-dark.png', width: 861, height: 865 },
};

export interface BrandMarkProps extends Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'srcSet' | 'width' | 'height'
> {
  variant?: BrandMarkVariant;
  /** Rendered size in px (square for `mark`; height for `lockup`, width auto). */
  size?: number;
}

export function BrandMark({
  variant = 'mark',
  size = 32,
  alt = variant === 'mark' ? 'IPRS shield mark' : 'IPRS — Identity. Verification. Intelligence.',
  className,
  ...props
}: BrandMarkProps) {
  const meta = SOURCES[variant];
  const aspect = meta.width / meta.height;
  const width = variant === 'mark' ? size : Math.round(size * aspect);
  const height = size;
  return (
    <img
      src={meta.src}
      width={width}
      height={height}
      alt={alt}
      loading="eager"
      decoding="async"
      draggable={false}
      className={cn('shrink-0 select-none', className)}
      style={{ width, height }}
      {...props}
    />
  );
}
