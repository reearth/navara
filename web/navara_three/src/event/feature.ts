import type { RenderableFeature } from "@navara/engine";
import { Mesh, Sprite, Object3D } from "three";
import type { CommonUniforms } from "../uniforms";
import type { BufferLoader } from ".";

import { renderText } from "./features/text";
import { renderPoint } from "./features/point";
import { renderBillboard } from "./features/billboard";
import { renderModel } from "./features/model";
import { renderPolyline } from "./features/polyline";
import { renderPolygon } from "./features/polygon";

export function renderFeature(
  f: RenderableFeature,
  buf: BufferLoader,
  uniforms: CommonUniforms,
): Promise<Mesh | Sprite | Object3D | undefined> | undefined {
  if (f.point) {
    return renderPoint(f.point, uniforms);
  }
  if (f.billboard) {
    return renderBillboard(f.billboard, uniforms);
  }
  if (f.model) {
    return renderModel(f.model, buf, uniforms);
  }
  if (f.polyline) {
    return renderPolyline(f.polyline, buf, uniforms);
  }
  if (f.polygon) {
    return renderPolygon(f.polygon, buf, uniforms);
  }
  if (f.text) {
    return renderText(f.text, uniforms);
  }
}
