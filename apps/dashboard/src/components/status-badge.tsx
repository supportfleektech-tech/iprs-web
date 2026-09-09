import { Badge, type BadgeTone } from '@fleek/ui';
import { DashboardIcon, type DashboardIconName } from './dashboard-icons';

const labelByTone: Record<BadgeTone, string> = {
  green: 'Success',
  red: 'Failed',
  amber: 'Attention',
  blue: 'Info',
  slate: 'Neutral',
};

const iconByTone: Record<BadgeTone, DashboardIconName> = {
  green: 'check',
  red: 'alert',
  amber: 'clock',
  blue: 'info',
  slate: 'info',
};

export type StatusBadgeProps = {
  tone?: BadgeTone;
  label?: string;
  icon?: DashboardIconName | false;
  className?: string;
  /** @deprecated Use `tone` instead */
  status?: string;
};

function resolveTone(raw: string | undefined): BadgeTone {
  const normalized = (raw ?? 'slate').toLowerCase();
  if (['success', 'completed', 'active', 'enabled', 'paid', 'approved', 'valid', 'clear', 'listed'].includes(normalized)) return 'green';
  if (['failed', 'expired', 'invalid', 'rejected', 'inactive', 'disabled', 'not_found', 'high', 'critical', 'watchlist', 'error'].includes(normalized)) return 'red';
  if (['pending', 'processing', 'medium', 'attention'].includes(normalized)) return 'amber';
  if (['low', 'info', 'informational'].includes(normalized)) return 'blue';
  if (['green', 'red', 'amber', 'blue', 'slate'].includes(normalized)) return normalized as BadgeTone;
  return 'slate';
}

export function StatusBadge({ tone, label, icon, className, status }: StatusBadgeProps) {
  const resolvedTone = resolveTone(tone ?? status);
  const resolvedLabel = label ?? labelByTone[resolvedTone];
  const resolvedIcon: DashboardIconName | null =
    icon === false ? null : (icon ?? iconByTone[resolvedTone] ?? null);

  return (
    <Badge tone={resolvedTone} className={className}>
      {resolvedIcon && <DashboardIcon name={resolvedIcon} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      <span>{resolvedLabel}</span>
    </Badge>
  );
}
