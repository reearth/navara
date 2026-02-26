import { type TextMesh as NavaraTextMesh } from "@navara/engine";

import type { BufferLoader } from "..";
import type { ViewContext } from "../../core";
import { InstancedSdfTextMesh, InstancedTextMesh } from "../../mesh";
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
  const fontManager = viewContext.fontManager;

  // Use SDF pipeline when a font URL is specified and FontManager is available
  if (fontUrl && fontManager) {
    await fontManager.loadFont(fontUrl);

    const textGroup = new InstancedSdfTextMesh(m, buf, fontManager, fontUrl, uniforms, {
      renderOrder: FEATURE_RENDER_ORDER,
      viewContext,
      layerId,
    });

    console.log("Created InstancedSdfTextMesh with font", fontUrl);

    return textGroup;
  }

  // Fallback to Troika-based text
  const textGroup = new InstancedTextMesh(m, buf, uniforms, {
    renderOrder: FEATURE_RENDER_ORDER,
    viewContext,
    layerId,
  });

  return textGroup;
}

export function processTextChanged(
  obj: InstancedTextMesh | InstancedSdfTextMesh,
  m: NavaraTextMesh,
  buf: BufferLoader,
  active: boolean,
  renderFlag: RenderFlag,
) {
  obj._update(m, buf, active, () => {
    renderFlag.forceUpdate = true;
  });
}
