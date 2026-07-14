import { useCallback, useState } from "react";

import {
  DEFAULT_LANG,
  SUPPORTED_LANGS,
  type Lang,
} from "../../pages/examples/sections";

const STORAGE_KEY = "navara:lang";

function isLang(value: unknown): value is Lang {
  return (SUPPORTED_LANGS as readonly string[]).includes(value as string);
}

/** Detect the preferred language from the browser, falling back to default. */
function detectLang(): Lang {
  if (typeof navigator === "undefined") return DEFAULT_LANG;
  const base = navigator.language.toLowerCase().split("-")[0];
  return isLang(base) ? base : DEFAULT_LANG;
}

/**
 * Gallery language state: initialized from localStorage or the browser, and
 * persisted on change. Mirrors {@link useDarkMode}'s storage/toggle shape.
 */
export function useLang(options?: { storageKey?: string }) {
  const storageKey = options?.storageKey ?? STORAGE_KEY;

  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return detectLang();
    try {
      const raw = localStorage.getItem(storageKey);
      return isLang(raw) ? raw : detectLang();
    } catch {
      return detectLang();
    }
  });

  const setLang = useCallback(
    (next: Lang) => {
      setLangState(next);
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        // ignore storage errors (e.g., privacy mode)
      }
    },
    [storageKey],
  );

  const toggle = useCallback(() => {
    setLang(lang === "ja" ? "en" : "ja");
  }, [lang, setLang]);

  return { lang, setLang, toggle } as const;
}
