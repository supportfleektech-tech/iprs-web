import { jsx as _jsx } from 'react/jsx-runtime';
import { forwardRef } from 'react';
import { cn } from '../lib/cn';
export const Textarea = forwardRef(({ className, ...props }, ref) => {
  return _jsx('textarea', {
    className: cn(
      'flex min-h-[80px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder-slate-400 focus:border-teal-brand focus:outline-none focus:ring-1 focus:ring-teal-brand',
      className,
    ),
    ref: ref,
    ...props,
  });
});
Textarea.displayName = 'Textarea';
