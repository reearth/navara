/**
 * Example-page bootstrap for the curated gallery examples (pages/examples/*).
 *
 * `initializeExample` bundles the plumbing every demo page needs but that is
 * not part of the example's API story, so a single opaque call is all that
 * shows up in the displayed main.ts source.
 *
 * Currently that plumbing is scene-loaded signalling: the detail page
 * (`pages/detail/DetailApp.tsx`) renders the loading overlay over the demo
 * iframe and dismisses it when the demo posts SCENE_LOADED_MESSAGE. The page
 * counts as settled once the engine has applied no new work (`postUpdate`)
 * for a quiet window and every passed async-loading mesh has finished
 * loading.
 */

import type ThreeView from "@navaramap/three";

/** `type` of the message posted to the embedding window when the scene settles. */
export const SCENE_LOADED_MESSAGE = "navara-example:scene-loaded";

/**
 * Quiet time without engine updates before the page counts as settled. Long
 * enough to bridge the gaps inside the page's own setup (awaited fetches
 * between `add*` calls) and a loaded splat's first sorted render.
 */
const SETTLE_QUIET_MS = 1500;

/** How often the settle conditions are re-checked. */
const POLL_INTERVAL_MS = 250;

/**
 * A mesh handle whose data loads asynchronously outside the engine's event
 * stream: its desc emits `load` / `error` events (GLTFModelDesc,
 * SplatMeshDesc).
 */
type AsyncLoadedMeshHandle = {
  ref: {
    on(event: "load" | "error", callback: () => void): unknown;
  };
};

/**
 * Hooks the demo page up to the example harness. Call at the end of the
 * page's setup, passing the handles of any async-loading meshes (GLTF
 * models, 3D Gaussian Splats) so the loading overlay waits for their data.
 * Standalone `/demo/...` visits post the scene-loaded message to the page's
 * own window, which tooling (e.g. the screenshot script) can observe.
 */
export const initializeExample = (
  view: ThreeView,
  loadingMeshes: AsyncLoadedMeshHandle[] = [],
): void => {
  // `postUpdate` fires whenever the engine applied new work (tiles,
  // geometry) in a frame, so a long enough gap means the engine is idle.
  let lastActivityAt = performance.now();
  view.on("postUpdate", () => (lastActivityAt = performance.now()));

  let pendingLoads = loadingMeshes.length;
  for (const mesh of loadingMeshes) {
    // A failed load also finishes the wait, so the overlay never hangs.
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      pendingLoads--;
      lastActivityAt = performance.now();
    };
    mesh.ref.on("load", finish);
    mesh.ref.on("error", finish);
  }

  const timer = window.setInterval(() => {
    if (pendingLoads > 0) return;
    if (performance.now() - lastActivityAt < SETTLE_QUIET_MS) return;
    window.clearInterval(timer);
    window.parent.postMessage({ type: SCENE_LOADED_MESSAGE }, "*");
  }, POLL_INTERVAL_MS);
};
