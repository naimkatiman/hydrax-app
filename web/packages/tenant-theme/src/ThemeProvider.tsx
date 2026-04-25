import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { TenantTheme } from "./types";
import { applyTheme } from "./applyTheme";

const ThemeContext = createContext<TenantTheme | null>(null);

interface ThemeProviderProps {
  readonly theme: TenantTheme;
  readonly children: ReactNode;
}

export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): TenantTheme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme() must be used inside <ThemeProvider>");
  }
  return ctx;
}
