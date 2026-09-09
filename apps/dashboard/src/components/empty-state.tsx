import Link from 'next/link';
import { DashboardIcon } from './dashboard-icons';

export type EmptyStateAction =
  | { label: string; href: string }
  | { label: string; onClick: () => void };

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: EmptyStateAction;
  /** @deprecated Use `action` */
  actionLabel?: string;
  /** @deprecated Use `action` */
  actionHref?: string;
}

export function EmptyState({ title, description, action, actionLabel, actionHref }: EmptyStateProps) {
  const resolvedAction: EmptyStateAction | undefined =
    action ?? (actionHref && actionLabel ? { label: actionLabel, href: actionHref } : undefined);

  return (
    <div className="flex min-h-48 flex-col items-center justify-center px-6 py-12 text-center" role="status" aria-live="polite">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-100" aria-hidden="true">
        <DashboardIcon name="clipboard" className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-navy-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">{description}</p>
      {resolvedAction && (
        <>
          {'href' in resolvedAction ? (
            <Link
              href={resolvedAction.href}
              className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-navy-900 px-5 text-sm font-medium text-white transition-colors hover:bg-navy-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
            >
              {resolvedAction.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={resolvedAction.onClick}
              className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-navy-900 px-5 text-sm font-medium text-white transition-colors hover:bg-navy-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
            >
              {resolvedAction.label}
            </button>
          )}
        </>
      )}
    </div>
  );
}
