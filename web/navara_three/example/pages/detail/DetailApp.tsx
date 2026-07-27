import { ArrowLeft, Check, Copy, ExternalLink, Moon, Sun } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createHighlighter } from "shiki";
import type { Highlighter } from "shiki";

import { SCENE_LOADED_MESSAGE } from "../../helpers/initialize";
import { docsUrl, localize, SECTION_LABELS } from "../examples/sections";
import type { ExampleMeta, Lang, Localized } from "../examples/sections";

import { useDarkMode } from "@/components/hooks/useDarkMode";
import { useLang } from "@/components/hooks/useLang";
import { LangSelect } from "@/components/LangSelect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import "../index/main.css";

/** UI chrome strings for the detail page. */
const UI = {
  back: { en: "Gallery", ja: "ギャラリー" },
  source: { en: "Source", ja: "ソースコード" },
  copy: { en: "Copy", ja: "コピー" },
  copied: { en: "Copied", ja: "コピーしました" },
  openDemo: { en: "Open demo", ja: "デモを開く" },
  docs: { en: "Docs", ja: "ドキュメント" },
  notFound: { en: "Example not found", ja: "example が見つかりません" },
  toggleTheme: { en: "Toggle theme", ja: "テーマを切り替え" },
  toggleLang: { en: "Switch language", ja: "言語を切り替え" },
} satisfies Record<string, Record<Lang, string>>;

/**
 * Every curated example's meta and its raw source, collected once. Keyed by the
 * example path relative to `examples/`, e.g. "getting-started/hello-world".
 * The raw source is provided to the page as data via vite's `?raw` import.
 */
const META = keyBy(
  import.meta.glob<{ default: ExampleMeta }>("../examples/**/meta.ts", {
    eager: true,
  }),
  /\/meta\.ts$/,
  (m) => m.default,
);

type SourceLang = "ts" | "tsx";
type CodeEntry = { source: string; lang: SourceLang };

const CODE: Record<string, CodeEntry> = {};
for (const [key, source] of Object.entries(
  import.meta.glob<string>("../examples/**/main.{ts,tsx}", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
)) {
  const lang: SourceLang = key.endsWith(".tsx") ? "tsx" : "ts";
  const path = key
    .replace(/^\.\.\/examples\//, "")
    .replace(/\/main\.(ts|tsx)$/, "");
  CODE[path] = { source, lang };
}

/** Lazily created, shared Shiki highlighter for the example sources. */
let highlighterPromise: Promise<Highlighter> | null = null;
function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: ["ts", "tsx"],
    });
  }
  return highlighterPromise;
}

function keyBy<M, T>(
  modules: Record<string, M>,
  fileSuffix: RegExp,
  pick: (mod: M) => T,
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [key, mod] of Object.entries(modules)) {
    const path = key.replace(/^\.\.\/examples\//, "").replace(fileSuffix, "");
    out[path] = pick(mod);
  }
  return out;
}

/** Current example path from the URL, e.g. "/getting-started/hello-world" -> "getting-started/hello-world". */
function currentPath(): string {
  return window.location.pathname
    .replace(/^\//, "")
    .replace(/\.html$/, "")
    .replace(/\/$/, "");
}

export const DetailApp = () => {
  const { lang, setLang } = useLang();
  const { isDark: dark, toggle: toggleTheme } = useDarkMode();
  const [copied, setCopied] = useState(false);

  const path = useMemo(() => currentPath(), []);
  const meta = META[path];
  const code = CODE[path];
  const demoSrc = `/demo/${path}`;

  // Shiki-highlighted markup for the source. Falls back to plain text while the
  // highlighter loads or if highlighting fails.
  const [highlighted, setHighlighted] = useState<string | null>(null);
  useEffect(() => {
    // `code` is derived from the page path and never changes at runtime, so
    // there is no stale `highlighted` value to reset here.
    if (!code) {
      return;
    }
    let cancelled = false;
    getHighlighter()
      .then((hl) =>
        hl.codeToHtml(code.source, {
          lang: code.lang,
          themes: { light: "github-light", dark: "github-dark" },
          // Emit CSS variables so the `.dark` class drives the theme without
          // re-highlighting on toggle.
          defaultColor: false,
        }),
      )
      .then((html) => {
        if (!cancelled) setHighlighted(html);
      })
      .catch(() => {
        if (!cancelled) setHighlighted(null);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  // Demo/page scroll arbitration. The embedded map reacts to wheel events but
  // does not preventDefault, so a wheel over the iframe both zooms the map and
  // chains out to scroll this page. We resolve the conflict by intent:
  //   - Pointer resting over the demo (not mid-scroll) => "engaged": lock the
  //     page scroll so the wheel only drives the map.
  //   - The page is being scrolled => page wins: a transparent shield covers the
  //     iframe so the gesture keeps scrolling the document and never reaches the
  //     map, even while the cursor passes over it. When scrolling settles, the
  //     shield lifts and, if the pointer is still over the demo, we engage.
  const demoRef = useRef<HTMLIFrameElement>(null);

  // Loading screen over the demo. This page owns the overlay so it also covers
  // the time before the iframe document loads; the demo posts
  // SCENE_LOADED_MESSAGE from its view's first `idle` event to dismiss it.
  const [demoLoaded, setDemoLoaded] = useState(false);
  const [overlayGone, setOverlayGone] = useState(false);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (
        (event.data as { type?: string } | null)?.type ===
          SCENE_LOADED_MESSAGE &&
        event.source === demoRef.current?.contentWindow
      ) {
        setDemoLoaded(true);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Scene loading has no measurable progress (tiles stream until the engine
  // settles), so ease a pseudo-progress toward 90% over time, snap to 100% on
  // the demo's signal (derived below), and fade the overlay once 100% has
  // been visible.
  useEffect(() => {
    if (demoLoaded) {
      const timer = window.setTimeout(() => setOverlayGone(true), 450);
      return () => window.clearTimeout(timer);
    }
    let raf = 0;
    let start: number | undefined;
    const tick = (time: number) => {
      if (start === undefined) start = time;
      const elapsed = (time - start) / 1000;
      setProgress(0.9 * (1 - Math.exp(-elapsed / 3)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [demoLoaded]);
  const shownProgress = demoLoaded ? 1 : progress;

  const pointerInsideRef = useRef(false);
  const scrollIdleTimer = useRef<number | null>(null);
  const [engaged, setEngaged] = useState(false);
  const [scrolling, setScrolling] = useState(false);

  const engageDemo = () => {
    setEngaged(true);
    demoRef.current?.contentWindow?.focus();
  };

  // Any wheel/scroll on the page gives the document priority and defers demo
  // engagement until the gesture has settled.
  const noteScroll = () => {
    setScrolling(true);
    setEngaged(false);
    if (scrollIdleTimer.current !== null) {
      window.clearTimeout(scrollIdleTimer.current);
    }
    scrollIdleTimer.current = window.setTimeout(() => {
      setScrolling(false);
      if (pointerInsideRef.current) engageDemo();
    }, 200);
  };

  const onDemoPointerEnter = () => {
    pointerInsideRef.current = true;
    if (!scrolling) engageDemo();
  };
  const onDemoPointerLeave = () => {
    pointerInsideRef.current = false;
    setEngaged(false);
  };

  useEffect(() => {
    return () => {
      if (scrollIdleTimer.current !== null) {
        window.clearTimeout(scrollIdleTimer.current);
      }
    };
  }, []);

  const copy = () => {
    if (!code) return;
    navigator.clipboard
      .writeText(code.source)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        // Ignore clipboard errors (e.g., permissions / insecure context).
      });
  };

  const t = (text: Localized) => localize(text, lang);

  return (
    <div
      onWheel={noteScroll}
      onScroll={noteScroll}
      className={`h-screen w-screen bg-background text-foreground [scrollbar-gutter:stable] ${
        engaged ? "overflow-hidden" : "overflow-auto"
      }`}
    >
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="-ml-2 h-auto self-start px-2 py-1 text-muted-foreground"
            >
              <a href="/" className="flex items-center gap-1.5">
                <ArrowLeft className="h-4 w-4" />
                {t(UI.back)}
              </a>
            </Button>
            {meta && (
              <div className="min-w-0">
                <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
                  {t(meta.title)}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {SECTION_LABELS[meta.section][lang]}
                </p>
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <LangSelect
              lang={lang}
              setLang={setLang}
              label={t(UI.toggleLang)}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label={t(UI.toggleTheme)}
              onClick={toggleTheme}
            >
              {dark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </header>

        {!meta ? (
          <p className="text-muted-foreground">
            {t(UI.notFound)} “{path}”.
          </p>
        ) : (
          <>
            <p className="mb-5 text-sm text-muted-foreground">
              {t(meta.description)}
            </p>

            <div className="mb-6 flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="-ml-2 px-2 text-muted-foreground hover:text-foreground"
              >
                <a
                  href={demoSrc}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t(UI.openDemo)}
                </a>
              </Button>
              {meta.docs && (
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="px-2 text-muted-foreground hover:text-foreground"
                >
                  <a
                    href={docsUrl(meta.docs, lang)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t(UI.docs)}
                  </a>
                </Button>
              )}
            </div>

            <div className="relative mb-8 h-[520px]">
              <iframe
                ref={demoRef}
                src={demoSrc}
                title={t(meta.title)}
                loading="lazy"
                onPointerEnter={onDemoPointerEnter}
                onPointerLeave={onDemoPointerLeave}
                onTouchStart={onDemoPointerEnter}
                onTouchEnd={onDemoPointerLeave}
                onTouchCancel={onDemoPointerLeave}
                className="block h-full w-full rounded-lg border bg-muted"
              />
              <div
                aria-hidden
                className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center rounded-lg border bg-background transition-opacity duration-500 ${
                  overlayGone ? "opacity-0" : "opacity-100"
                }`}
              >
                <div className="h-1 w-[220px] overflow-hidden rounded-full bg-foreground/15">
                  <div
                    className="h-full rounded-full bg-foreground/85 transition-[width] duration-200 ease-linear"
                    style={{ width: `${Math.round(shownProgress * 100)}%` }}
                  />
                </div>
                <span className="mt-3 text-xs tabular-nums text-foreground/70">
                  {Math.round(shownProgress * 100)}%
                </span>
              </div>
              {scrolling && (
                // Transparent shield: while the page is scrolling, it catches the
                // wheel so the gesture keeps scrolling the document instead of
                // reaching (and zooming) the map. It tracks the pointer so the
                // demo can engage once scrolling settles.
                <div
                  onPointerEnter={() => {
                    pointerInsideRef.current = true;
                  }}
                  onPointerLeave={() => {
                    pointerInsideRef.current = false;
                  }}
                  className="absolute inset-0 rounded-lg"
                />
              )}
            </div>

            {code && (
              <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b py-3">
                  <CardTitle className="text-sm font-medium">
                    {t(UI.source)}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copy}
                    className="flex items-center gap-1.5"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copied ? t(UI.copied) : t(UI.copy)}
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {highlighted ? (
                    <div
                      className="shiki-source"
                      // Shiki output is generated from the trusted local example
                      // source, so rendering it as HTML is safe here.
                      dangerouslySetInnerHTML={{ __html: highlighted }}
                    />
                  ) : (
                    <pre className="overflow-x-auto p-4 text-xs leading-relaxed">
                      <code>{code.source}</code>
                    </pre>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};
