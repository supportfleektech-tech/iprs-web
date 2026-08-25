export * from './lib/cn';
export * from './components/button';
export * from './components/card';
export * from './components/badge';
export * from './components/input';

import * as React from 'react';

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
      <div className="text-3xl font-bold brand-gradient-text">{value}</div>
      <div className="mt-1 text-sm font-medium text-slate-700">{label}</div>
      {hint && <div className="text-xs text-slate-400">{hint}</div>}
    </div>
  );
}
