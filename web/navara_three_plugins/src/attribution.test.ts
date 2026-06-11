import { describe, it, expect } from "vitest";

import {
  aggregateCredits,
  appendSanitizedHtml,
  isAttributionHtml,
  matchesZoom,
  type AttributionChild,
} from "./attribution";

describe("aggregateCredits", () => {
  it("splits on ';', trims, dedups, and orders by frequency then name", () => {
    expect(aggregateCredits(["Google;Airbus", "Airbus ; Maxar"])).toEqual([
      "Airbus", // count 2 → first
      "Google", // count 1, alpha before Maxar
      "Maxar",
    ]);
  });

  it("ignores empty parts and whitespace", () => {
    expect(aggregateCredits([";; Google ;", ""])).toEqual(["Google"]);
  });

  it("returns an empty list when there are no credits", () => {
    expect(aggregateCredits([])).toEqual([]);
  });
});

describe("isAttributionHtml", () => {
  it("returns true for raw HTML credits", () => {
    expect(isAttributionHtml({ attributionHtml: "<a>x</a>" })).toBe(true);
  });

  it("returns false for structured sources", () => {
    expect(isAttributionHtml({ attribution: "国土地理院" })).toBe(false);
  });
});

describe("matchesZoom", () => {
  const band: AttributionChild = { title: "x", minZoom: 14, maxZoom: 18 };

  it("matches everything when the level is undefined", () => {
    expect(matchesZoom(band, undefined)).toBe(true);
  });

  it("matches within the band, inclusive of both bounds", () => {
    expect(matchesZoom(band, 14)).toBe(true);
    expect(matchesZoom(band, 16)).toBe(true);
    expect(matchesZoom(band, 18)).toBe(true);
  });

  it("rejects levels outside the band", () => {
    expect(matchesZoom(band, 13)).toBe(false);
    expect(matchesZoom(band, 19)).toBe(false);
  });

  it("treats a missing bound as unbounded on that side", () => {
    expect(matchesZoom({ title: "x" }, 0)).toBe(true);
    expect(matchesZoom({ title: "x", minZoom: 10 }, 100)).toBe(true);
    expect(matchesZoom({ title: "x", minZoom: 10 }, 9)).toBe(false);
    expect(matchesZoom({ title: "x", maxZoom: 10 }, 0)).toBe(true);
    expect(matchesZoom({ title: "x", maxZoom: 10 }, 11)).toBe(false);
  });
});

describe("appendSanitizedHtml", () => {
  function render(html: string): HTMLElement {
    const el = document.createElement("div");
    appendSanitizedHtml(el, html);
    return el;
  }

  it("keeps plain text verbatim", () => {
    expect(render("国土地理院").textContent).toBe("国土地理院");
  });

  it("keeps <a href> and forces safe target/rel", () => {
    const el = render('see <a href="https://gsi.go.jp">GSI</a>');
    const anchor = el.querySelector("a");
    expect(anchor?.getAttribute("href")).toBe("https://gsi.go.jp");
    expect(anchor?.target).toBe("_blank");
    expect(anchor?.rel).toBe("noopener noreferrer");
    expect(anchor?.textContent).toBe("GSI");
  });

  it("drops <script> elements (keeps only their text, never executes)", () => {
    const el = render("a<script>alert(1)</script>b");
    expect(el.querySelector("script")).toBeNull();
    expect(el.textContent).toBe("aalert(1)b");
  });

  it("drops <img> entirely, removing event-handler attack surface", () => {
    const el = render('<img src="x" onerror="alert(1)">');
    expect(el.querySelector("img")).toBeNull();
  });

  it("unwraps unknown tags while preserving nested <a>", () => {
    const el = render('<b>bold <a href="https://x.test">link</a></b>');
    expect(el.querySelector("b")).toBeNull();
    expect(el.querySelector("a")?.getAttribute("href")).toBe("https://x.test");
    expect(el.textContent).toBe("bold link");
  });
});
