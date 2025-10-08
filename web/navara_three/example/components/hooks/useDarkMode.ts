import { useCallback, useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark" | "system";

const DEFAULT_STORAGE_KEY = "navara:theme";

function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined" || !("matchMedia" in window)) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyHtmlClass(isDark: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", isDark);
}

function sanitizeTheme(value: unknown): Theme | null {
  return value === "light" || value === "dark" || value === "system"
    ? (value as Theme)
    : null;
}

export function useDarkMode(options?: {
  storageKey?: string;
  defaultTheme?: Theme;
}) {
  const storageKey = options?.storageKey ?? DEFAULT_STORAGE_KEY;
  const defaultTheme: Theme = options?.defaultTheme ?? "system";

  // Init theme from storage or default.
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return defaultTheme;
    try {
      const raw = localStorage.getItem(storageKey);
      return sanitizeTheme(raw) ?? defaultTheme;
    } catch {
      return defaultTheme;
    }
  });

  // Track system preference to re-render on OS theme change.
  const [systemDark, setSystemDark] = useState<boolean>(() =>
    getSystemPrefersDark(),
  );

  const resolvedDark = useMemo<boolean>(() => {
    return theme === "dark" || (theme === "system" && systemDark);
  }, [theme, systemDark]);

  // Keep <html class="dark"> in sync with resolved theme.
  useEffect(() => {
    applyHtmlClass(resolvedDark);
  }, [resolvedDark]);

  // React to OS/browser theme changes when using system.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent | { matches: boolean }) => {
      setSystemDark("matches" in e ? e.matches : false);
    };
    // Initialize state in case something changed before mount.
    setSystemDark(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        // ignore storage errors (e.g., privacy mode)
      }
    },
    [storageKey],
  );

  const toggle = useCallback(() => {
    // When on system, toggling sets an explicit preference opposite of current resolution.
    const next: Theme = resolvedDark ? "light" : "dark";
    setTheme(next);
  }, [resolvedDark, setTheme]);

  return {
    isDark: resolvedDark,
    theme,
    setTheme,
    toggle,
  } as const;
}
