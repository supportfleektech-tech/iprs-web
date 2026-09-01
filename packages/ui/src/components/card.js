import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from '../lib/cn';
export function Card({ className, ...props }) {
    return (_jsx("div", { className: cn('rounded-xl border border-slate-200 bg-white p-6 shadow-sm', className), ...props }));
}
export function CardHeader({ className, ...props }) {
    return _jsx("div", { className: cn('mb-4 flex flex-col gap-1', className), ...props });
}
export function CardTitle({ className, ...props }) {
    return _jsx("h3", { className: cn('text-lg font-semibold text-[var(--navy-900)]', className), ...props });
}
export function CardDescription({ className, ...props }) {
    return _jsx("p", { className: cn('text-sm text-slate-500', className), ...props });
}
export function CardContent({ className, ...props }) {
    return _jsx("div", { className: cn('', className), ...props });
}
