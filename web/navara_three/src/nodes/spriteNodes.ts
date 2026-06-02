import {
  Fn,
  cameraViewMatrix,
  cross,
  dFdx,
  dFdy,
  dot,
  float,
  normalize,
  positionView,
  select,
  tan,
  vec3,
  vec4,
} from "three/tsl";
import type { Node } from "three/webgpu";

/**
 * TSL ports of the GLSL helpers used by the instanced point sprite shaders
 * (`shaders/glsl/point.frag.glsl`, `pixelToWorld.glsl`,
 * `chunks/sprite_height_pars_vertex.glsl`, `chunks/horizon_culling_*.glsl`).
 *
 * These stay numerically identical to their GLSL counterparts so the TSL point
 * mesh renders the same pixels as the legacy `ShaderMaterial` path it replaces.
 */

/**
 * Anti-aliased circle mask, port of `nvr_circle_alpha`. Returns ~1 inside the
 * 0.5-radius circle, a soft `0..1` ramp across a 0.01 border, and 0 outside.
 * `uv` is expected pre-centered (i.e. `uv - 0.5`), matching the GLSL caller.
 */
export const circleAlpha = Fn(([uv]: [Node<"vec2">]) => {
  const border = float(0.01);
  const radius = float(0.5);
  const dist = radius.sub(uv.length());
  // mix(0, 1, t) === t, so return t directly.
  return select(
    dist.greaterThan(border),
    float(1.0),
    select(dist.greaterThan(0.0), dist.div(border), float(0.0)),
  );
}).setLayout({
  name: "nvr_circleAlpha",
  type: "float",
  inputs: [{ name: "uv", type: "vec2" }],
});

/**
 * Port of `nvr_pxToWorld`: converts a pixel size to a world-space size at a
 * given view distance, for screen-space (non-meters) sprite sizing.
 */
export const pxToWorld = Fn(
  ([px, fov, screenHeight, worldPosition, cameraPosition]: [
    Node<"float">,
    Node<"float">,
    Node<"float">,
    Node<"vec3">,
    Node<"vec3">,
  ]) => {
    const distance = cameraPosition.sub(worldPosition).length();
    const worldScreenHeight = tan(fov.div(2.0)).mul(distance).mul(2.0);
    const worldPerPixel = worldScreenHeight.div(screenHeight);
    return px.mul(worldPerPixel);
  },
).setLayout({
  name: "nvr_pxToWorld",
  type: "float",
  inputs: [
    { name: "px", type: "float" },
    { name: "fov", type: "float" },
    { name: "screenHeight", type: "float" },
    { name: "worldPosition", type: "vec3" },
    { name: "cameraPosition", type: "vec3" },
  ],
});

/**
 * Port of `mvr_getMvHeightOffset`: the view-space offset that lifts a sprite by
 * `addHeight` meters along the ellipsoid surface normal at `worldPos` (ECEF).
 * Returns the `.xyz` offset (the GLSL version returned a vec4 with `w = 0`).
 * `addHeight = 0` yields a zero offset, so no branch is needed.
 *
 * `w = 0` means only the view rotation applies, matching the legacy
 * `viewMatrix * vec4(heightOffset, 0.0)`.
 */
export function heightOffsetView(
  worldPos: Node<"vec3">,
  addHeight: Node<"float">,
): Node<"vec3"> {
  const globeNormal = normalize(worldPos);
  const offset = globeNormal.mul(addHeight);
  return cameraViewMatrix.mul(vec4(offset, 0.0)).xyz;
}

/**
 * Port of `nvr_horizon_culled` (Cesium horizon culling). Returns true when the
 * ECEF `target` point is hidden below the ellipsoidal horizon as seen from
 * `camera` (also ECEF). Composed inline (not a layout function) so the boolean
 * result feeds directly into a `select()`.
 *
 * `ONE_OVER_WGS84_RADII` mirrors `shaders/glsl/chunks/ellipsoid.glsl`.
 */
const ONE_OVER_WGS84_RADII = vec3(
  1.0 / 6378137.0,
  1.0 / 6378137.0,
  1.0 / 6356752.3142451793,
);

export function horizonCulled(
  target: Node<"vec3">,
  camera: Node<"vec3">,
): Node<"bool"> {
  const cameraScaled = camera.mul(ONE_OVER_WGS84_RADII);
  const targetScaled = target.mul(ONE_OVER_WGS84_RADII);
  const vt = cameraScaled.sub(targetScaled);
  const vc = cameraScaled;
  const a = dot(vc, vc).sub(1.0);
  return dot(vt, vc).greaterThan(a);
}

/**
 * View-space face normal derived from screen-space derivatives of
 * `positionView`, the TSL analogue of the legacy `screenSpaceNormal()` (which
 * used `gl_FragCoord` derivatives). Flipped to always face the camera
 * (`z >= 0`). Feeds the MRT normal slot for camera-facing sprites, where the
 * geometry's own `normalView` does not reflect the view-space quad expansion.
 */
export const screenSpaceNormalView: Node<"vec3"> = (() => {
  const n = normalize(cross(dFdx(positionView), dFdy(positionView)));
  return select(n.z.lessThan(0.0), n.negate(), n);
})();
