import { type TextMesh as NavaraTextMesh } from "@navara/engine";

import { BatchedCurveTextMesh, BatchedSdfTextMesh } from "../../mesh";
import { FEATURE_RENDER_ORDER } from "../../renderOrder";
import type { EventContext } from "../context";

/** Either text pipeline produces a "batched" container with the same outer
 *  contract (renderOrder, setActive, _update). The shared base is enough for
 *  the feature event loop. */
export type BatchedTextMesh = BatchedSdfTextMesh | BatchedCurveTextMesh;

export async function renderText(
  ctx: EventContext,
  m: NavaraTextMesh,
  layerId: string,
) {
  const { fontManager } = ctx;
  const fontUrl = m.material.font;
  if (!fontUrl || fontUrl === "") {
    console.warn(
      "material.font is required for text rendering but was not set.",
    );
    return;
  }

  if (!fontManager) return;

  const useCurves = m.material.useCurveRenderer === true;
  try {
    const text = m.material.text ?? "";
    const loadedFaceUrls = new Set<string>();

    // Shape upfront so the per-feature mesh has data on first draw. The two
    // pipelines have parallel `prepareText{Curves}?` paths; pick by the flag.
    if (fontManager.isFamily(fontUrl)) {
      if (text) {
        if (useCurves) {
          await fontManager.prepareTextCurves(fontUrl, text, loadedFaceUrls);
        } else {
          await fontManager.prepareText(fontUrl, text, loadedFaceUrls);
        }
      }
    } else {
      await fontManager.loadFont(fontUrl);
      if (text) {
        if (useCurves) await fontManager.prepareTextCurves(fontUrl, text);
        else await fontManager.prepareText(fontUrl, text);
      }
    }

    const options = { renderOrder: FEATURE_RENDER_ORDER, layerId };
    const textGroup: BatchedTextMesh = useCurves
      ? new BatchedCurveTextMesh(ctx, m, fontUrl, options, loadedFaceUrls)
      : new BatchedSdfTextMesh(ctx, m, fontUrl, options, loadedFaceUrls);
    textGroup.setActive(m.active);
    return textGroup;
  } catch (e) {
    console.warn(`Failed to load or prepare font "${fontUrl}". Error:`, e);
  }
}

export async function processTextChanged(
  obj: BatchedTextMesh,
  m: NavaraTextMesh,
  active: boolean,
) {
  await obj._update(m, () => {
    obj.ctx.renderFlag.forceUpdate = true;
  });
  obj.setActive(active);
}
