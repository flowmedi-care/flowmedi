/**
 * FlowMed Design Tokens
 * Single source of truth for brand colors, spacing, typography, motion.
 * CSS variables in app/globals.css mirror these values.
 */

export const stone = {
  50: "#FAFAF9",
  100: "#F5F5F4",
  200: "#E7E5E4",
  300: "#D6D3D1",
  400: "#A8A29E",
  500: "#78716C",
  600: "#57534E",
  700: "#44403C",
  800: "#292524",
  900: "#1C1917",
  950: "#0C0A09",
} as const;

export const sage = {
  50: "#F3F8F6",
  100: "#E4EFEA",
  200: "#C9DED4",
  300: "#A3C4B5",
  400: "#78A593",
  500: "#4F8A78",
  600: "#3D6F60",
  700: "#325A4E",
  800: "#2B4A41",
  900: "#253E37",
  950: "#142622",
} as const;

export const semantic = {
  success: "#3D8B6A",
  successMuted: "#E8F5EF",
  successMutedForeground: "#1F5C42",
  warning: "#C4843A",
  warningMuted: "#FBF3E8",
  warningMutedForeground: "#8A5A1E",
  error: "#C45C5C",
  errorMuted: "#FAEEEE",
  errorMutedForeground: "#8B3333",
  info: "#5B6B7A",
  infoMuted: "#EEF1F4",
  infoMutedForeground: "#3D4A56",
} as const;

/** HSL components (without hsl() wrapper) for CSS variables */
export const hsl = {
  background: "60 9% 98%",
  foreground: "24 10% 10%",
  card: "0 0% 100%",
  cardForeground: "24 10% 10%",
  primary: "162 29% 34%",
  primaryHover: "162 29% 28%",
  primaryActive: "162 27% 23%",
  primaryForeground: "0 0% 100%",
  secondary: "162 20% 94%",
  secondaryForeground: "162 29% 22%",
  muted: "60 5% 96%",
  mutedForeground: "25 5% 45%",
  accent: "162 25% 92%",
  accentForeground: "162 29% 22%",
  destructive: "0 45% 55%",
  destructiveForeground: "0 0% 100%",
  border: "20 6% 90%",
  input: "20 6% 90%",
  ring: "162 28% 42%",
  surface: "0 0% 100%",
  surfaceElevated: "0 0% 100%",
  surfaceMuted: "60 5% 96%",
  divider: "20 6% 90%",
  overlay: "24 10% 10%",
  disabled: "25 5% 65%",
  skeleton: "60 5% 96%",
  focusRing: "162 28% 42%",
  success: "158 38% 39%",
  successForeground: "0 0% 100%",
  successMuted: "152 40% 93%",
  successMutedForeground: "158 48% 24%",
  warning: "32 55% 50%",
  warningForeground: "0 0% 100%",
  warningMuted: "36 60% 94%",
  warningMutedForeground: "32 65% 32%",
  info: "210 14% 42%",
  infoForeground: "0 0% 100%",
  infoMuted: "210 20% 94%",
  infoMutedForeground: "210 18% 29%",
  popover: "0 0% 100%",
  popoverForeground: "24 10% 10%",
} as const;

export const hslDark = {
  background: "24 10% 4%",
  foreground: "60 9% 98%",
  card: "24 10% 6%",
  cardForeground: "60 9% 98%",
  primary: "162 22% 56%",
  primaryHover: "162 22% 62%",
  primaryActive: "162 25% 50%",
  primaryForeground: "162 29% 10%",
  secondary: "24 10% 12%",
  secondaryForeground: "60 9% 98%",
  muted: "24 10% 12%",
  mutedForeground: "25 5% 60%",
  accent: "162 20% 14%",
  accentForeground: "162 22% 75%",
  destructive: "0 50% 50%",
  destructiveForeground: "0 0% 100%",
  border: "24 10% 16%",
  input: "24 10% 16%",
  ring: "162 22% 56%",
  surface: "24 10% 6%",
  surfaceElevated: "24 10% 8%",
  surfaceMuted: "24 10% 10%",
  divider: "24 10% 16%",
  overlay: "24 10% 4%",
  disabled: "25 5% 40%",
  skeleton: "24 10% 12%",
  focusRing: "162 22% 56%",
  success: "158 35% 45%",
  successForeground: "0 0% 100%",
  successMuted: "158 20% 14%",
  successMutedForeground: "152 40% 70%",
  warning: "32 50% 48%",
  warningForeground: "0 0% 100%",
  warningMuted: "32 25% 14%",
  warningMutedForeground: "36 60% 70%",
  info: "210 14% 55%",
  infoForeground: "0 0% 100%",
  infoMuted: "210 15% 14%",
  infoMutedForeground: "210 20% 70%",
  popover: "24 10% 8%",
  popoverForeground: "60 9% 98%",
} as const;

export const typography = {
  fontFamily: "var(--font-sans), system-ui, sans-serif",
  scale: {
    display: { size: "3rem", lineHeight: "1.1", weight: 700, tracking: "-0.02em" },
    h1: { size: "2.25rem", lineHeight: "1.15", weight: 700, tracking: "-0.02em" },
    h2: { size: "1.75rem", lineHeight: "1.2", weight: 600, tracking: "-0.02em" },
    h3: { size: "1.375rem", lineHeight: "1.25", weight: 600, tracking: "-0.01em" },
    h4: { size: "1.125rem", lineHeight: "1.3", weight: 600, tracking: "0" },
    body: { size: "1rem", lineHeight: "1.5", weight: 400, tracking: "0" },
    bodySm: { size: "0.875rem", lineHeight: "1.5", weight: 400, tracking: "0" },
    caption: { size: "0.75rem", lineHeight: "1.4", weight: 500, tracking: "0" },
    overline: { size: "0.6875rem", lineHeight: "1.3", weight: 600, tracking: "0.06em" },
  },
} as const;

export const spacing = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96] as const;

export const radius = {
  sm: "0.375rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  "2xl": "1.25rem",
  full: "9999px",
} as const;

export const shadows = {
  none: "none",
  sm: "0 1px 2px rgba(28, 25, 23, 0.04), 0 1px 3px rgba(28, 25, 23, 0.06)",
  md: "0 2px 8px rgba(28, 25, 23, 0.06), 0 4px 16px rgba(28, 25, 23, 0.04)",
  lg: "0 4px 16px rgba(28, 25, 23, 0.08), 0 12px 40px rgba(28, 25, 23, 0.06)",
  xl: "0 8px 32px rgba(28, 25, 23, 0.10), 0 24px 64px rgba(28, 25, 23, 0.08)",
  elevated:
    "0 1px 3px rgba(28, 25, 23, 0.04), 0 4px 12px rgba(28, 25, 23, 0.03)",
  elevatedLg:
    "0 2px 8px rgba(28, 25, 23, 0.04), 0 8px 24px rgba(28, 25, 23, 0.06)",
} as const;

export const motion = {
  instant: { duration: 100, easing: "cubic-bezier(0.25, 0.1, 0.25, 1)" },
  micro: { duration: 150, easing: "cubic-bezier(0.25, 0.1, 0.25, 1)" },
  standard: { duration: 250, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
  emphasis: { duration: 400, easing: "spring", stiffness: 300, damping: 30 },
} as const;

/** Chart palette — monochrome sage gradient for data viz */
export const chartColors = [
  sage[200],
  sage[300],
  sage[400],
  sage[500],
  sage[600],
  sage[700],
] as const;

export type StoneShade = keyof typeof stone;
export type SageShade = keyof typeof sage;
