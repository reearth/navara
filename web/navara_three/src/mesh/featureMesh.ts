import { Unimplemented } from "@navara/core";
import type { Color, Material } from "three";

// Interface for feature's mesh.
export class FeatureMesh {
  _setFeatureColor(_color: Color, _material?: Material) {
    throw new Unimplemented();
  }
  _getFeatureColor(): Color {
    throw new Unimplemented();
  }
  _setFeatureShow(_visible: boolean) {
    throw new Unimplemented();
  }
  _setFeatureExtrudedHeight(_height: number) {
    throw new Unimplemented();
  }
  _setFeatureHeight(_height: number) {
    throw new Unimplemented();
  }
  _setFeatureWidth(_width: number) {
    throw new Unimplemented();
  }
  _setFeatureSize(_size: number) {
    throw new Unimplemented();
  }
  _setFeatureOpacity(_opacity: number) {
    throw new Unimplemented();
  }
  _setFrustumCulled(_culled: boolean) {
    throw new Unimplemented();
  }
}

export const isFeatureMesh = (v: object): v is FeatureMesh => {
  return (
    "_setFeatureColor" in v &&
    "_getFeatureColor" in v &&
    "_setFeatureShow" in v &&
    "_setFeatureExtrudedHeight" in v &&
    "_setFeatureWidth" in v &&
    "_setFeatureSize" in v &&
    "_setFeatureOpacity" in v &&
    "_setFrustumCulled" in v
  );
};
