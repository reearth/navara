import type { AttributionSource } from "@navara/three_plugins";

import type { Dataset } from "./constants";

/**
 * Build an {@link AttributionSource} from a shared {@link Dataset}, so the
 * attribution for the services Navara uses lives in one place (`constants.ts`)
 * instead of being re-declared per example (which invites drift / mistakes).
 *
 * Maps `attributionUrl` → `url` and carries `logo`. Pass `extra` for the
 * plugin-specific view options that don't belong on a dataset
 * (`creditLayerId`, `collapsible`, `children`).
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
  ...extra,
});
