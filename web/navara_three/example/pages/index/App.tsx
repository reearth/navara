import { Moon, Sun, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import invariant from "tiny-invariant";

import { PageList } from "./PageList";

import { useDarkMode } from "@/components/hooks/useDarkMode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

import "./main.css";

declare const PAGES: string[];

export const App = () => {
  const [query, setQuery] = useState("");
  const { isDark: dark, toggle } = useDarkMode();

  const pages = useMemo(
    () =>
      (PAGES || [])
        .filter((p) => p !== "index")
        .sort((a, b) => a.localeCompare(b)),
    [],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter((p) => p.toLowerCase().includes(q));
  }, [pages, query]);

  return (
    <div className="h-screen w-screen overflow-auto bg-background text-foreground">
      <div className="mx-auto max-w-6xl p-6">
        <Card className="mb-4">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Navara Three — Examples</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle theme"
              onClick={toggle}
            >
              {dark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search examples…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        <Separator className="mb-4" />

        <PageList pages={filtered} />
      </div>
    </div>
  );
};

const root = document.getElementById("main");
invariant(root);
createRoot(root).render(<App />);
