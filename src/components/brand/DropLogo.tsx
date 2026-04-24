import type { CSSProperties, SVGProps } from "react";

export interface DropLogoProps extends Omit<SVGProps<SVGSVGElement>, "viewBox" | "children"> {
  variant?: "mark" | "wordmark" | "app-icon";
  size?: number;
  mono?: boolean;
  accentColor?: string;
  wordmarkColor?: string;
}

function DropMarkSvg({
  size,
  style,
  primary,
  accent,
  ...rest
}: Omit<DropLogoProps, "variant" | "wordmarkColor" | "mono"> & {
  primary: string;
  accent: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={style} {...rest}>
      <path d="M4 9.5 16 3l12 6.5v13L16 29 4 22.5v-13Z" fill={primary} />
      <path d="M4 9.5 16 16l12-6.5" stroke={accent} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M16 16v13" stroke={accent} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M11.5 19.5 16 23.5 20.5 19.5" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M16 13v10.5" stroke={accent} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function DropLogo({
  variant = "mark",
  size = 32,
  mono = false,
  accentColor,
  wordmarkColor,
  style,
  ...rest
}: DropLogoProps) {
  const primary = mono ? "currentColor" : "var(--action-primary)";
  const accent = accentColor ?? (mono ? "var(--bg-elevated)" : "var(--bg-surface)");
  const textColor = wordmarkColor ?? (mono ? "currentColor" : "var(--text-primary)");

  if (variant === "app-icon") {
    return (
      <svg width={size} height={size} viewBox="0 0 512 512" fill="none" style={style} {...rest}>
        <rect width="512" height="512" rx="112" fill={mono ? "currentColor" : "var(--action-primary)"} />
        <g transform="translate(96 96) scale(10)">
          <path d="M4 9.5 16 3l12 6.5v13L16 29 4 22.5v-13Z" fill={mono ? "var(--bg-elevated)" : "var(--bg-surface)"} />
          <path d="M4 9.5 16 16l12-6.5" stroke={mono ? "currentColor" : "var(--action-primary)"} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M16 16v13" stroke={mono ? "currentColor" : "var(--action-primary)"} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M11.5 19.5 16 23.5 20.5 19.5" stroke={mono ? "currentColor" : "var(--action-primary)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M16 13v10.5" stroke={mono ? "currentColor" : "var(--action-primary)"} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  if (variant === "wordmark") {
    const width = size * (120 / 32);
    return (
      <svg width={width} height={size} viewBox="0 0 120 32" fill="none" style={style} {...rest}>
        <g>
          <path d="M4 9.5 16 3l12 6.5v13L16 29 4 22.5v-13Z" fill={mono ? "currentColor" : "var(--action-primary)"} />
          <path d="M4 9.5 16 16l12-6.5" stroke={accent} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M16 16v13" stroke={accent} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M11.5 19.5 16 23.5 20.5 19.5" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M16 13v10.5" stroke={accent} strokeWidth="1.6" strokeLinecap="round" />
        </g>
        <text
          x="40"
          y="22"
          fontFamily="var(--font-sans)"
          fontSize="20"
          fontWeight="600"
          fill={textColor}
          letterSpacing="-0.3"
        >
          Drop
        </text>
      </svg>
    );
  }

  return <DropMarkSvg size={size} primary={primary} accent={accent} style={style} {...rest} />;
}

export function dropLogoStyle(size = 32): CSSProperties {
  return {
    width: size,
    height: size,
    display: "block",
    flexShrink: 0,
  };
}
