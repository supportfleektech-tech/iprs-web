import { jsx as _jsx } from "react/jsx-runtime";
import * as React from 'react';
import { cn } from '../lib/cn';
export const Input = React.forwardRef(({ className, ...props }, ref) => (_jsx("input", { ref: ref, className: cn('flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal-500)] focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50', className), ...props })));
Input.displayName = 'Input';
export function Label({ className, ...props }) {
    return (_jsx("label", { className: cn('mb-1.5 block text-sm font-medium text-[var(--navy-900)]', className), ...props }));
}
export function FieldError({ children }) {
    if (!children)
        return null;
    return _jsx("p", { className: "mt-1 text-xs text-red-500", children: children });
}
