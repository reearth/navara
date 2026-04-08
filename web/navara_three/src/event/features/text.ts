import { type TextMesh as NavaraTextMesh } from "@navara/engine";
import type { FontManager } from "@navara/font";

import type { BufferLoader } from "..";
import { BatchedSdfTextMesh } from "../../mesh";
import { FEATURE_RENDER_ORDER } from "../../renderOrder";
import type { RenderFlag } from "../../type";
import type { CommonUniforms } from "../../uniforms";

export async function renderText(
  m: NavaraTextMesh,
  buf: BufferLoader,
  uniforms: CommonUniforms,
  layerId: string,
  fontManager?: FontManager,
) {
  const fontUrl = m.material.font;
  if (!fontUrl || fontUrl === "") {
    console.warn(
      "material.font is required for text rendering but was not set.",
    );
    return;
  }

  // Use SDF pipeline when a font URL is specified and FontManager is available
  if (fontManager) {
    try {
      // Load font(s) then shape the text so the cache is populated before mesh construction.
      // For font families, only the face URLs needed for `text` are loaded (lazy).
      // For raw URLs, the single font file is loaded directly.
      const text = m.material.text ?? "";
      const loadedFaceUrls = new Set<string>();
      if (fontManager.isFamily(fontUrl)) {
        if (text) await fontManager.prepareText(fontUrl, text, loadedFaceUrls);
      } else {
        await fontManager.loadFont(fontUrl);
        if (text) await fontManager.prepareText(fontUrl, text);
      }

      const textGroup = new BatchedSdfTextMesh(
        m,
        buf,
        fontManager,
        fontUrl,
        uniforms,
        {
          renderOrder: FEATURE_RENDER_ORDER,
          layerId,
        },
        loadedFaceUrls,
      );
      textGroup.setActive(m.active);

      return textGroup;
    } catch (e) {
      console.warn(`Failed to load or prepare font "${fontUrl}". Error:`, e);
    }
  }
}

export async function processTextChanged(
  obj: BatchedSdfTextMesh,
  m: NavaraTextMesh,
  buf: BufferLoader,
  renderFlag: RenderFlag,
  active: boolean,
) {
  await obj._update(m, buf, () => {
    renderFlag.forceUpdate = true;
  });
  obj.setActive(active);
}
