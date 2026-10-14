import { DarkTheme, type Theme } from "expo-router";

// Mirrors the CSS variables in global.css for React Navigation chrome and for
// components that take colours as props (icons, the Markdown renderer).
export const THEME = {
  background: "hsl(150 12% 8%)",
  foreground: "hsl(60 10% 96%)",
  card: "hsl(150 10% 11%)",
  primary: "hsl(155 60% 69%)",
  border: "hsl(150 8% 23%)",
  muted: "hsl(150 5% 66%)",
  destructive: "hsl(5 75% 55%)",
  board: "hsl(160 30% 14%)",
  chalk: "hsl(60 20% 94%)",
  code: "hsl(160 25% 10%)",
};

export const NAV_THEME: Theme = {
  ...DarkTheme,
  colors: {
    background: THEME.background,
    border: THEME.border,
    card: THEME.card,
    notification: THEME.destructive,
    primary: THEME.primary,
    text: THEME.foreground,
  },
};
