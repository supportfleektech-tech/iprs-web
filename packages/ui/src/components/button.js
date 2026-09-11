import { jsx as _jsx } from 'react/jsx-runtime';
import * as React from 'react';
import { cn } from '../lib/cn';
const variants = {
  primary:
    'bg-[var(--teal-500)] text-[var(--navy-950)] hover:bg-[var(--teal-400)] font-semibold shadow-sm',
  secondary:
    'bg-white text-[var(--navy-900)] border border-slate-200 hover:border-slate-300 font-medium',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-[var(--navy-900)]',
  danger: 'bg-red-500 text-white hover:bg-red-600 font-medium',
  outline: 'border border-[var(--teal-500)] text-[var(--teal-500)] hover:bg-teal-50 font-medium',
};
const sizes = {
  sm: 'h-8 px-3 text-xs rounded-md',
  md: 'h-10 px-4 text-sm rounded-lg',
  lg: 'h-12 px-6 text-base rounded-xl',
};
export const Button = React.forwardRef(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) =>
    _jsx('button', {
      ref: ref,
      className: cn(
        'inline-flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal-500)] disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
        variants[variant],
        sizes[size],
        className,
      ),
      ...props,
    }),
);
Button.displayName = 'Button';
