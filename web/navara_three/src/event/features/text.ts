import {
  type TextMesh as NavaraTextMesh,
  type TextMaterial,
} from "@navara/engine";

import { TextMesh } from "../../mesh";
import type { RenderFlag } from "../../type";
import type { CommonUniforms } from "../../uniforms";

export async function renderText(m: NavaraTextMesh, uniforms: CommonUniforms) {
  const textGroup = new TextMesh(m, uniforms);
  textGroup._updateTextByMaterial(m.material, m.active);

  return textGroup;
}

export function processTextChanged(
  obj: TextMesh,
  material: TextMaterial,
  active: boolean,
  renderFlag: RenderFlag,
) {
  obj._updateTextByMaterial(material, active, () => {
    renderFlag.forceUpdate = true;
  });
}
