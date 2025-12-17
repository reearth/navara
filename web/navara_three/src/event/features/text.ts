import { type TextMesh as NavaraTextMesh } from "@navara/engine";

import type { BufferLoader } from "..";
import { InstancedTextMesh } from "../../mesh";
import { FEATURE_RENDER_ORDER } from "../../renderOrder";
import type { RenderFlag } from "../../type";
import type { CommonUniforms } from "../../uniforms";

export async function renderText(
  m: NavaraTextMesh,
  buf: BufferLoader,
  uniforms: CommonUniforms,
  offsetDepth: boolean,
) {
  const textGroup = new InstancedTextMesh(m, buf, uniforms, offsetDepth,
  {
    renderOrder: FEATURE_RENDER_ORDER,
  });

  return textGroup;
}

export function processTextChanged(
  obj: InstancedTextMesh,
  m: NavaraTextMesh,
  buf: BufferLoader,
  active: boolean,
  renderFlag: RenderFlag,
) {
  obj._update(m, buf, active, () => {
    renderFlag.forceUpdate = true;
  });
}
