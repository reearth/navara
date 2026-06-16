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
 */
export const datasetToSource = (
  dataset: Dataset,
  extra?: Partial<AttributionSource>,
): AttributionSource => ({
  attribution: dataset.attribution ?? "",
  url: dataset.attributionUrl,
  logo: dataset.logo,
  ...extra,
});
