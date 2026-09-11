import { Badge, type BadgeTone } from '@fleek/ui';
import { DashboardIcon, type DashboardIconName } from './dashboard-icons';

const iconByTone: Record<BadgeTone, DashboardIconName> = {
  green: 'check',
  red: 'alert',
  amber: 'clock',
  blue: 'info',
  slate: 'info',
};

type StatusBadgeRequiredProps = {
  tone: BadgeTone;
  label: string;
  icon?: DashboardIconName | false;
  className?: string;
  /** @deprecated Prefer tone+label; status bridge only for legacy callers */
  status?: string;
};

type StatusBadgeLegacyProps = {
  status: string;
  tone?: BadgeTone;
  label?: string;
  icon?: DashboardIconName | false;
  className?: string;
};

/**
 * Per spec tone+label are required. Legacy `status` prop is deprecated and maps to tone/label
 * via internal fallback — retained only to unblock pre-Task2 callers.
 */
export type StatusBadgeProps = StatusBadgeRequiredProps | StatusBadgeLegacyProps;

const labelByTone: Record<BadgeTone, string> = {
  green: 'Success',
  red: 'Failed',
  amber: 'Attention',
  blue: 'Info',
  slate: 'Neutral',
};

function resolveTone(raw: string | undefined): BadgeTone {
  const normalized = (raw ?? 'slate').toLowerCase();
  if (
    [
      'success',
      'completed',
      'active',
      'enabled',
      'paid',
      'approved',
      'valid',
      'clear',
      'listed',
    ].includes(normalized)
  )
    return 'green';
  if (
    [
      'failed',
      'expired',
      'invalid',
      'rejected',
      'inactive',
      'disabled',
      'not_found',
      'high',
      'critical',
      'watchlist',
      'error',
    ].includes(normalized)
  )
    return 'red';
  if (['pending', 'processing', 'medium', 'attention'].includes(normalized)) return 'amber';
  if (['low', 'info', 'informational'].includes(normalized)) return 'blue';
  if (['green', 'red', 'amber', 'blue', 'slate'].includes(normalized))
    return normalized as BadgeTone;
  return 'slate';
}

export function StatusBadge(props: StatusBadgeProps) {
  const { icon, className, status } = props as StatusBadgeLegacyProps & StatusBadgeRequiredProps;
  const tone = (props as StatusBadgeRequiredProps).tone as BadgeTone | undefined;
  const label = (props as StatusBadgeRequiredProps).label as string | undefined;
  // tone/label required per spec; status fallback only for deprecated bridge (runtime safety for legacy callers).
  const resolvedTone: BadgeTone = tone ?? resolveTone(status);
  const resolvedLabel =
    label ?? (status ? (labelByTone[resolveTone(status)] ?? status) : labelByTone[resolvedTone]);
  const resolvedIcon: DashboardIconName | null =
    icon === false ? null : (icon ?? iconByTone[resolvedTone] ?? null);

  return (
    <Badge tone={resolvedTone} className={className}>
      {resolvedIcon && (
        <DashboardIcon name={resolvedIcon} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
      <span>{resolvedLabel}</span>
    </Badge>
  );
}
