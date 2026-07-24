/**
 * Example-page bootstrap for the curated gallery examples (pages/examples/*).
 *
 * `initializeExample` bundles the plumbing every demo page needs but that is
 * not part of the example's API story, so a single opaque call is all that
 * shows up in the displayed main.ts source.
 *
 * Currently that plumbing is scene-loaded signalling: the detail page
 * (`pages/detail/DetailApp.tsx`) renders the loading overlay over the demo
 * iframe, and on the view's first `idle` event (the engine settling once no
 * Rust-side events — tile fetches, geometry builds — have arrived for the
 * idle threshold) a message is posted to the embedding window to dismiss it.
 */

import type ThreeView from "@navaramap/three";

/** `type` of the message posted to the embedding window when the scene settles. */
export const SCENE_LOADED_MESSAGE = "navara-example:scene-loaded";

/**
 * Hooks the demo page up to the example harness. Call right after
 * constructing the view, before `view.init()`. Standalone `/demo/...` visits
 * post the scene-loaded message to the page's own window, which tooling
 * (e.g. the screenshot script) can observe.
 */
export const initializeExample = (view: ThreeView): void => {
  let signalled = false;
  view.on("idle", () => {
    if (signalled) return;
    signalled = true;
    window.parent.postMessage({ type: SCENE_LOADED_MESSAGE }, "*");
  });
};
