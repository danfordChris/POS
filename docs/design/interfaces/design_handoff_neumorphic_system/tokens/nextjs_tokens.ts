// Duka Stock — neumorphic design tokens (TS). Pair with nextjs_tokens.css custom properties,
// or use these objects directly if not using CSS variables (e.g. in styled-components/inline styles).

export type ThemeMode = 'light' | 'dark';

export const colors = {
  light: {
    surface: 'oklch(96.5% 0.012 75)',
    surfaceSunken: 'oklch(93.5% 0.014 75)',
    textPrimary: 'oklch(26% 0.02 75)',
    textSecondary: 'oklch(45% 0.018 75)',
    textDisabled: 'oklch(68% 0.012 75)',
    accent: 'oklch(56% 0.1 195)',
    accentHover: 'oklch(51% 0.1 195)',
    accentContrast: 'oklch(99% 0.005 195)',
    success: 'oklch(56% 0.13 145)',
    warning: 'oklch(62% 0.14 75)',
    danger: 'oklch(55% 0.17 25)',
    info: 'oklch(56% 0.1 235)',
    shadowLight: 'oklch(99.5% 0.005 75 / 0.9)',
    shadowDark: 'oklch(76% 0.02 75 / 0.65)',
  },
  dark: {
    surface: 'oklch(28% 0.012 255)',
    surfaceSunken: 'oklch(24% 0.012 255)',
    textPrimary: 'oklch(93% 0.008 255)',
    textSecondary: 'oklch(73% 0.01 255)',
    textDisabled: 'oklch(52% 0.01 255)',
    accent: 'oklch(70% 0.11 195)',
    accentHover: 'oklch(75% 0.11 195)',
    accentContrast: 'oklch(16% 0.02 195)',
    success: 'oklch(65% 0.14 145)',
    warning: 'oklch(72% 0.14 75)',
    danger: 'oklch(66% 0.17 25)',
    info: 'oklch(66% 0.1 235)',
    shadowLight: 'oklch(35% 0.015 255 / 0.7)',
    shadowDark: 'oklch(12% 0.01 255 / 0.85)',
  },
} as const;

export const radius = { control: 16, card: 22, sheet: 28, pill: 999 } as const;

export const spacing = [4, 8, 12, 16, 20, 24, 32, 40, 48] as const;

export const elevation = {
  sm: { x: 3, y: 3, blur: 6 },
  md: { x: 6, y: 6, blur: 10 },
  lg: { x: 10, y: 10, blur: 18 },
  inset: { x: 3, y: 3, blur: 6 },
} as const;

export const fontFamily = "'Nunito', system-ui, sans-serif";

export function raisedShadow(mode: ThemeMode, e: { x: number; y: number; blur: number }) {
  const t = colors[mode];
  return `${e.x}px ${e.y}px ${e.blur}px ${t.shadowDark}, -${e.x}px -${e.y}px ${e.blur}px ${t.shadowLight}`;
}

export function insetShadow(mode: ThemeMode, e: { x: number; y: number; blur: number }) {
  const t = colors[mode];
  return `inset ${e.x}px ${e.y}px ${e.blur}px ${t.shadowDark}, inset -${e.x}px -${e.y}px ${e.blur}px ${t.shadowLight}`;
}
