import type { Matrix4, Texture } from "three";

type Ref<K extends string, T> = { [k in K]: T | undefined | null };
type RefThree<T> = Ref<"value", T>;

// TODO: Separate as individual library
export type CommonUniforms = {
  viewportAndPixelRatio: RefThree<[x: number, y: number, z: number]>;
  frustumRatio: RefThree<[x: number, y: number, z: number, w: number]>;
  frustumNearFar: RefThree<[x: number, y: number]>;
  tGlobeDepth: RefThree<Texture>;
  inverseProjectionMatrix: RefThree<Matrix4>;
};
