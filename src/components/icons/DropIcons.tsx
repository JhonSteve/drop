import type { ReactNode, SVGProps } from "react";

export interface DropIconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  size?: number;
  strokeWidthOverride?: number;
}

interface DropIconBaseProps extends DropIconProps {
  children: ReactNode;
}

const DropIcon = ({ children, size = 20, strokeWidthOverride = 1.75, style, ...rest }: DropIconBaseProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidthOverride}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0, ...style }}
    {...rest}
  >
    {children}
  </svg>
);

const FILL = {
  fill: "currentColor",
  fillOpacity: 0.14,
  stroke: "none",
} as const;

export const DropIcons = {
  send: (props: DropIconProps) => (
    <DropIcon {...props}>
      <path {...FILL} d="M21 3 3 10.5l7 2 2 7 9-16.5Z" />
      <path d="M21 3 3 10.5l7 2 2 7L21 3Z" />
      <path d="m10 12.5 11-9.5" />
    </DropIcon>
  ),
  fileUp: (props: DropIconProps) => (
    <DropIcon {...props}>
      <path {...FILL} d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
      <path d="M12 18v-6" />
      <path d="m9 15 3-3 3 3" />
    </DropIcon>
  ),
  folderUp: (props: DropIconProps) => (
    <DropIcon {...props}>
      <path {...FILL} d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <path d="M12 17v-5" />
      <path d="m9.5 14.5 2.5-2.5 2.5 2.5" />
    </DropIcon>
  ),
  download: (props: DropIconProps) => (
    <DropIcon {...props}>
      <path {...FILL} d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
    </DropIcon>
  ),
  copy: (props: DropIconProps) => (
    <DropIcon {...props}>
      <rect {...FILL} x="8" y="8" width="12" height="12" rx="2" />
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </DropIcon>
  ),
  qr: (props: DropIconProps) => (
    <DropIcon {...props}>
      <rect {...FILL} x="3" y="3" width="7" height="7" rx="1" />
      <rect {...FILL} x="3" y="14" width="7" height="7" rx="1" />
      <rect {...FILL} x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM20 14v3M14 20h3M17 17h4v4" />
    </DropIcon>
  ),
  shieldCheck: (props: DropIconProps) => (
    <DropIcon {...props}>
      <path {...FILL} d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" />
      <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </DropIcon>
  ),
  lock: (props: DropIconProps) => (
    <DropIcon {...props}>
      <rect {...FILL} x="4" y="11" width="16" height="10" rx="2" />
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
    </DropIcon>
  ),
  wifi: (props: DropIconProps) => (
    <DropIcon {...props}>
      <path d="M2 9a15 15 0 0 1 20 0" />
      <path d="M5 12.5a10 10 0 0 1 14 0" />
      <path d="M8.5 16a5 5 0 0 1 7 0" />
      <circle cx="12" cy="19" r="1.1" fill="currentColor" stroke="none" />
    </DropIcon>
  ),
  wifiOff: (props: DropIconProps) => (
    <DropIcon {...props}>
      <path d="M2 9a15 15 0 0 1 7-3.8" />
      <path d="M13 5.2a15 15 0 0 1 9 3.8" />
      <path d="M5 12.5a10 10 0 0 1 3.5-2.1" />
      <path d="M15 10.4a10 10 0 0 1 4 2.1" />
      <path d="M8.5 16a5 5 0 0 1 7 0" />
      <path d="M3 3l18 18" />
    </DropIcon>
  ),
  check: (props: DropIconProps) => (
    <DropIcon {...props}>
      <path d="m5 12 5 5 9-10" />
    </DropIcon>
  ),
  x: (props: DropIconProps) => (
    <DropIcon {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </DropIcon>
  ),
  trash: (props: DropIconProps) => (
    <DropIcon {...props}>
      <path {...FILL} d="M6 7h12l-1 13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7Z" />
      <path d="M4 7h16" />
      <path d="M6 7h12l-1 13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7Z" />
      <path d="M10 7V5a2 2 0 0 1 2-2 2 2 0 0 1 2 2v2" />
      <path d="M10 11v7M14 11v7" />
    </DropIcon>
  ),
  chevronDown: (props: DropIconProps) => (
    <DropIcon {...props}>
      <path d="m6 9 6 6 6-6" />
    </DropIcon>
  ),
  chevronUp: (props: DropIconProps) => (
    <DropIcon {...props}>
      <path d="m6 15 6-6 6 6" />
    </DropIcon>
  ),
  plus: (props: DropIconProps) => (
    <DropIcon {...props}>
      <path d="M12 5v14M5 12h14" />
    </DropIcon>
  ),
  settings: (props: DropIconProps) => (
    <DropIcon {...props}>
      <circle {...FILL} cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </DropIcon>
  ),
  pasteSend: (props: DropIconProps) => (
    <DropIcon {...props}>
      <rect {...FILL} x="6" y="4" width="10" height="14" rx="2" />
      <rect x="6" y="4" width="10" height="14" rx="2" />
      <path d="M9 4a2 2 0 0 1 2-2 2 2 0 0 1 2 2" />
      <path d="m16 18 4 2-2-4" />
      <path d="M11 13h3" />
    </DropIcon>
  ),
  device: (props: DropIconProps) => (
    <DropIcon {...props}>
      <rect {...FILL} x="3" y="4" width="14" height="10" rx="1.5" />
      <rect x="3" y="4" width="14" height="10" rx="1.5" />
      <rect x="15" y="9" width="6" height="11" rx="1.5" />
      <path d="M7 18h4" />
      <circle cx="18" cy="17" r="0.6" fill="currentColor" stroke="none" />
    </DropIcon>
  ),
  link: (props: DropIconProps) => (
    <DropIcon {...props}>
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66L11.5 6.8" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1.5-1.5" />
    </DropIcon>
  ),
  refresh: (props: DropIconProps) => (
    <DropIcon {...props}>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </DropIcon>
  ),
  alert: (props: DropIconProps) => (
    <DropIcon {...props}>
      <path {...FILL} d="M12 3 2 21h20L12 3Z" />
      <path d="M12 3 2 21h20L12 3Z" />
      <path d="M12 10v5" />
      <circle cx="12" cy="18" r="0.8" fill="currentColor" stroke="none" />
    </DropIcon>
  ),
  clock: (props: DropIconProps) => (
    <DropIcon {...props}>
      <circle {...FILL} cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </DropIcon>
  ),
  eye: (props: DropIconProps) => (
    <DropIcon {...props}>
      <path {...FILL} d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </DropIcon>
  ),
  eyeOff: (props: DropIconProps) => (
    <DropIcon {...props}>
      <path d="M4 4 20 20" />
      <path d="M9.5 5.3A10 10 0 0 1 12 5c6.5 0 10 7 10 7a15.8 15.8 0 0 1-3.3 4.1" />
      <path d="M6.5 6.5A15.8 15.8 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 4.3-1" />
      <path d="M10 10a3 3 0 0 0 4 4" />
    </DropIcon>
  ),
} as const;

export type DropIconName = keyof typeof DropIcons;
