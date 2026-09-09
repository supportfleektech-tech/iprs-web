export interface LoadingStateProps {
  label?: string;
  compact?: boolean;
}

export function LoadingState({ label = 'Loading workspace', compact = false }: LoadingStateProps) {
  return (
    <div
      className={
        compact
          ? 'flex items-center gap-2 text-sm text-slate-500'
          : 'flex min-h-56 items-center justify-center gap-3 text-sm text-slate-500'
      }
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span
        className={
          compact
            ? 'h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-teal-brand'
            : 'h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-teal-brand'
        }
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  );
}
