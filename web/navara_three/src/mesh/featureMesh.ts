import type { Color } from "three";

export class FeatureMesh {
  // Compat for non-batched mesh. For example, GeoJSON's polyline and polygon aren't batched for now.
  _setFeatureColor(_color: Color) {}
}

export const isFeatureMesh = (v: object): v is FeatureMesh => {
  return "_setFeatureColor" in v;
};
