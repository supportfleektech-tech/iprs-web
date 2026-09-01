import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export * from './lib/cn';
export * from './components/button';
export * from './components/card';
export * from './components/badge';
export * from './components/input';
export * from './components/textarea';
export function StatCard({ label, value, hint, }) {
    return (_jsxs("div", { className: "rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm", children: [_jsx("div", { className: "text-3xl font-bold brand-gradient-text", children: value }), _jsx("div", { className: "mt-1 text-sm font-medium text-slate-700", children: label }), hint && _jsx("div", { className: "text-xs text-slate-400", children: hint })] }));
}
