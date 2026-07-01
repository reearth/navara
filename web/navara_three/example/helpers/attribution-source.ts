import type { AttributionHtml, AttributionSource } from "@navara/three_plugins";

import type { Dataset } from "./constants";

/**
 * Build an {@link AttributionSource} from a shared {@link Dataset}, so the
 * attribution for the services Navara uses lives in one place (`constants.ts`)
 * instead of being re-declared per example (which invites drift / mistakes).
 *
 * Maps `attributionUrl` → `url` and carries `logo` / `logoUrl`. Pass `extra` for
 * the plugin-specific view options that don't belong on a dataset
 * (`creditLayerId`, `children`).
 *
 * `attribution` is required at the type level: a dataset without it (e.g. an
 * `attributionHtml`-only one) is rejected at compile time rather than rendering
 * a blank top-level entry.
 */
export const datasetToSource = (
  dataset: Dataset & { attribution: string },
  extra?: Partial<AttributionSource>,
): AttributionSource => ({
  attribution: dataset.attribution,
  url: dataset.attributionUrl,
  logo: dataset.logo,
  logoUrl: dataset.logoUrl,
  ...extra,
});

/**
 * Build an {@link AttributionHtml} from a dataset whose credit is raw HTML
 * (e.g. EOX's Sentinel-2 cloudless, where the notice carries anchor links).
 *
 * `attributionHtml` is required at the type level, mirroring
 * {@link datasetToSource}: a plain-text dataset belongs in `datasetToSource`,
 * not here.
 */
export const datasetToHtmlSource = (
  dataset: Dataset & { attributionHtml: string },
): AttributionHtml => ({
  attributionHtml: dataset.attributionHtml,
});
