import { type TextMesh as NavaraTextMesh } from "@navara/engine";

import type { BufferLoader } from "..";
import type { ViewContext } from "../../core";
import { BatchedSdfTextMesh } from "../../mesh";
import { FEATURE_RENDER_ORDER } from "../../renderOrder";
import type { RenderFlag } from "../../type";
import type { CommonUniforms } from "../../uniforms";

export async function renderText(
  m: NavaraTextMesh,
  buf: BufferLoader,
  uniforms: CommonUniforms,
  viewContext: ViewContext,
  layerId: string,
) {
  const fontUrl = m.material.font;
  if (!fontUrl || fontUrl === "") {
    console.warn(
      "material.font is required for text rendering but was not set.",
    );
    return;
  }
  const fontManager = viewContext.fontManager;

  // Use SDF pipeline when a font URL is specified and FontManager is available
  if (fontManager) {
    try {
      await fontManager.loadFont(fontUrl);

      // Pre-prepare the text in the worker so cache is populated before mesh construction
      const text = m.material.text ?? "";
      if (text) {
        await fontManager.prepareText(fontUrl, text);
      }

      const textGroup = new BatchedSdfTextMesh(
        m,
        buf,
        fontManager,
        fontUrl,
        uniforms,
        {
          renderOrder: FEATURE_RENDER_ORDER,
          viewContext,
          layerId,
        },
      );

      return textGroup;
    } catch (e) {
      console.warn(`Failed to load or prepare font "${fontUrl}". Error:`, e);
    }
  }
}

export function processTextChanged(
  obj: BatchedSdfTextMesh,
  m: NavaraTextMesh,
  buf: BufferLoader,
  active: boolean,
  renderFlag: RenderFlag,
) {
  obj._update(m, buf, active, () => {
    renderFlag.forceUpdate = true;
  });
}
