import { Fn, abs, normalize, select, vec2, vec3 } from "three/tsl";
import type { Node } from "three/webgpu";

/**
 * Octahedral normal encoding (vec3 -> vec2). Mirrors the GLSL
 * `packNormalToVec2` in `@takram/three-geospatial/shaders/packing.glsl`
 * so the encoded bytes round-trip through the shared MRT normal buffer
 * regardless of whether the writer is a TSL or GLSL material.
 *
 * Reference: https://jcgt.org/published/0003/02/01/paper.pdf
 */
export const packNormalToVec2 = Fn(([v]: [Node<"vec3">]) => {
  const av = abs(v);
  const denom = av.x.add(av.y).add(av.z);
  const p = v.xy.mul(denom.reciprocal());
  const signX = select(p.x.greaterThanEqual(0), 1.0, -1.0);
  const signY = select(p.y.greaterThanEqual(0), 1.0, -1.0);
  const folded = vec2(
    abs(p.y).oneMinus().mul(signX),
    abs(p.x).oneMinus().mul(signY),
  );
  return select(v.z.lessThanEqual(0), folded, p);
}).setLayout({
  name: "packNormalToVec2",
  type: "vec2",
  inputs: [{ name: "v", type: "vec3" }],
});

/**
 * Octahedral normal decoding (vec2 -> vec3). Inverse of
 * {@link packNormalToVec2}; mirrors the GLSL `unpackVec2ToNormal` in
 * `@takram/three-geospatial/shaders/packing.glsl`.
 *
 * The GLSL version uses a `signNotZero` helper; here we inline the
 * `select(...)` directly because `Fn`-wrapping a 1-liner has no payoff.
 */
export const unpackVec2ToNormal = Fn(([e]: [Node<"vec2">]) => {
  const z = abs(e.x).add(abs(e.y)).oneMinus();
  const signX = select(e.x.greaterThanEqual(0), 1.0, -1.0);
  const signY = select(e.y.greaterThanEqual(0), 1.0, -1.0);
  const foldedXY = vec2(
    abs(e.y).oneMinus().mul(signX),
    abs(e.x).oneMinus().mul(signY),
  );
  const xy = select(z.lessThan(0), foldedXY, e);
  return normalize(vec3(xy, z));
}).setLayout({
  name: "unpackVec2ToNormal",
  type: "vec3",
  inputs: [{ name: "e", type: "vec2" }],
});
