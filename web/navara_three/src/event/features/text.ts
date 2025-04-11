import { type TextMesh as NavaraTextMesh } from "@navara/engine";

import type { BufferLoader } from "..";
import { InstancedTextMesh } from "../../mesh";
import type { RenderFlag } from "../../type";
import type { CommonUniforms } from "../../uniforms";

export async function renderText(
  m: NavaraTextMesh,
  buf: BufferLoader,
  uniforms: CommonUniforms,
) {
  const textGroup = new InstancedTextMesh(m, buf, uniforms);

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
