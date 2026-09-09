import type { SVGProps } from 'react';

export type DashboardIconName =
  | 'search'
  | 'box'
  | 'clipboard'
  | 'wallet'
  | 'settings'
  | 'grid'
  | 'menu'
  | 'close'
  | 'arrowRight'
  | 'download'
  | 'plus'
  | 'check'
  | 'alert'
  | 'clock'
  | 'shield'
  | 'user'
  | 'logout'
  | 'refresh'
  | 'filter'
  | 'external'
  | 'file'
  | 'bank'
  | 'card'
  | 'layers'
  | 'activity'
  | 'info'
  | 'users'
  | 'building'
  | 'key'
  | 'chevronDown'
  | 'chevronRight';

const paths: Record<DashboardIconName, string> = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm10 17-4.35-4.35',
  box: 'M12 3 4 7v10l8 4 8-4V7l-8-4Zm0 0v10m8-7-8 4M4 7l8 4',
  clipboard: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9v6',
  wallet: 'M20 7H4a2 2 0 0 1 0-4h14v4m2 0v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5m18 0-2-2H4a2 2 0 0 0 0 4',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  grid: 'M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 6l12 12M18 6 6 18',
  arrowRight: 'M5 12h14m-6-6 6 6-6 6',
  download: 'M12 3v12m0 0 4-4m-4 4-4-4M4 21h16',
  plus: 'M12 5v14M5 12h14',
  check: 'm5 12 4 4L19 6',
  alert: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  info: 'M12 8h.01M12 12v4m9-4a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  clock: 'M12 6v6l4 2m5.5-2a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  shield: 'M12 3 5 6v5c0 4.5 3 8.2 7 10 4-1.8 7-5.5 7-10V6l-7-3Z',
  user: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9a8 8 0 0 1 16 0',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9',
  refresh: 'M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3M4 5v4h4m12 10v-4h-4',
  filter: 'M4 5h16l-6 7v6l-4 2v-8L4 5Z',
  external: 'M14 4h6v6M20 4l-9 9M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm0 0v5h5',
  bank: 'M3 10h18M5 10V7m4 3V7m6 3V7m4 3V7M3 10v8m18-8v8M3 21h18M6 18v3m12-3v3',
  card: 'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Zm0 0h18M7 13h4',
  layers: 'm12 3 9 5-9 5-9-5 9-5Zm-9 7 9 5 9-5m-18 7 9 5 9-5',
  activity: 'M3 12h4l3-8 4 16 3-8h4',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 11v-2a4 4 0 0 0-3-3.9m-2-3.1a4 4 0 0 1 0 7.8',
  building: 'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16m2 0H4m12 0h4a1 1 0 0 1 1 1v3H4v-3a1 1 0 0 1 1-1h11m4-9h-4m4 4h-4m4 4h-4',
  key: 'M14 10a4 4 0 1 0-7.6 1.7L3 17.5V21h3.5L12.3 19.6A4 4 0 0 0 14 10Zm0 0 4-4m-2-2 2 2',
  chevronDown: 'm6 9 6 6 6-6',
  chevronRight: 'm9 6 6 6-6 6',
};

export function DashboardIcon({
  name,
  className = 'h-5 w-5',
  ...props
}: SVGProps<SVGSVGElement> & { name: DashboardIconName }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.7}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
