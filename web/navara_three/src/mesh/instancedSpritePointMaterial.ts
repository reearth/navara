import { Color as ThreeColor, Vector2, Vector3 } from "three";
import {
  Discard,
  Fn,
  attribute,
  cameraPosition,
  cameraProjectionMatrix,
  cameraViewMatrix,
  clamp,
  float,
  max,
  positionGeometry,
  renderGroup,
  select,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { MeshBasicNodeMaterial, type NodeMaterial } from "three/webgpu";

import {
  highPrecisionOffsetFromAttributes,
  modelViewMatrixRTEUniform,
} from "../nodes/highPrecisionNode";
import {
  logarithmicDepthNode,
  setupNodeMaterialForMRT,
} from "../nodes/setupNodeMaterialForMRT";
import { nvr_batchIdToColor } from "../nodes/setupNodeMaterialForPicking";
import {
  circleAlpha,
  heightOffsetView,
  horizonCulled,
  pxToWorld,
  screenSpaceNormalView,
} from "../nodes/spriteNodes";

/** Reusable Vector2 to avoid per-frame allocations in onRenderUpdate. */
const _tmpSize = new Vector2();

/**
 * TSL NodeMaterial for the instanced **point** path of {@link InstancedSpriteMesh}.
 *
 * Replaces the legacy GLSL `ShaderMaterial` + `instancedSpriteMaterialEnhancer`
 * stack (`shaders/glsl/instancedSprite.{vert,frag}.glsl`) for non-billboard
 * points. It reads the exact same per-instance attributes the geometry already
 * carries (`instancePosition`/`instancePositionHIGH`+`LOW`, `instanceColor`,
 * `instanceShow`, `instanceHeight`, `instanceBatchID`) so the geometry setup is
 * unchanged.
 *
 * RTE eye-relative resolution reuses the shared per-render camera uniforms from
 * {@link highPrecisionNode} (no manual `onBeforeRender` needed); MRT, picking,
 * and logarithmic depth reuse the shared node helpers so this mesh stays in
 * lockstep with every other TSL mesh sharing the G-buffer.
 *
 * **Shared across meshes.** A NodeMaterial allocates its own uniform-buffer
 * (UBO) binding points, and WebGL has a small global pool of them. Point
 * features come from per-tile layers (MVT/GeoJSON), so a material-per-mesh
 * would exhaust the pool ("Maximum number of simultaneously usable uniforms
 * groups reached"). Instead {@link getInstancedPointNodeMaterial} caches one
 * material per `useRTE|logDepth|transparent|depthTest` combination, and each
 * {@link InstancedSpriteMesh} writes its per-mesh uniform values just-in-time
 * in `onBeforeRender` (which runs immediately before that mesh's UBO upload).
 * Per-instance data stays on each geometry's attributes.
 */
function createInstancedPointNodeMaterial(opts: {
  useRTE: boolean;
  logarithmicDepthBuffer: boolean;
  transparent: boolean;
  depthTest: boolean;
}) {
  const { useRTE, logarithmicDepthBuffer } = opts;

  // --- uniforms mutated by the mesh ---
  const uScale = uniform(100.0);
  const uCenter = uniform(new Vector2(0, 0));
  const uSizeInMeters = uniform(true);
  const uOffsetDepth = uniform(true);
  const uAlphaTest = uniform(0.0);
  const uAspect = uniform(1.0);
  const uPickable = uniform(false);
  const uEffectIdsMask = uniform(0.0);
  const uEmissiveColor = uniform(new ThreeColor(0x000000));
  const uEmissiveIntensity = uniform(0.0);
  // RTC anchor (non-RTE only); harmless when unused.
  const uRtcCenter = uniform(new Vector3(0, 0, 0));

  // --- per-frame camera-derived uniforms (self-updating, once per render) ---
  const uFovRad = uniform(1.0)
    .setGroup(renderGroup)
    .onRenderUpdate(function (frame) {
      const cam = frame.camera as {
        isPerspectiveCamera?: boolean;
        fov?: number;
      };
      if (cam?.isPerspectiveCamera && typeof cam.fov === "number") {
        this.value = (cam.fov * Math.PI) / 180;
      }
    });
  const uScreenHeightPx = uniform(1080.0)
    .setGroup(renderGroup)
    .onRenderUpdate(function (frame) {
      const renderer = frame.renderer as {
        getDrawingBufferSize: (target: Vector2) => Vector2;
        getPixelRatio: () => number;
      } | null;
      if (renderer) {
        this.value =
          renderer.getDrawingBufferSize(_tmpSize).y / renderer.getPixelRatio();
      }
    });

  // --- per-instance attributes ---
  const instanceColor = attribute<"vec3">("instanceColor", "vec3");
  const instanceShow = attribute<"float">("instanceShow", "float");
  const instanceHeight = attribute<"float">("instanceHeight", "float");
  const instanceBatchID = attribute<"float">("instanceBatchID", "float");

  // --- resolve eye-relative view position + ECEF world position ---
  let viewPos; // Node<"vec4"> — view-space position before quad expansion
  let absTransformed; // Node<"vec3"> — world ECEF position (height/culling)
  if (useRTE) {
    const resolved = highPrecisionOffsetFromAttributes(
      "instancePositionHIGH",
      "instancePositionLOW",
    );
    viewPos = modelViewMatrixRTEUniform.mul(vec4(resolved, 1.0));
    absTransformed = attribute<"vec3">("instancePositionHIGH", "vec3").add(
      attribute<"vec3">("instancePositionLOW", "vec3"),
    );
  } else {
    const instancePosition = attribute<"vec3">("instancePosition", "vec3");
    // RTC: rotate the small instance offset by the view, then add the
    // view-space RTC center. Equivalent to `viewMatrix * (instancePosition +
    // rtcCenter)` but keeps the large center term separate for f32 precision,
    // mirroring the legacy `viewMatrixRTC` trick. `w = 0` applies rotation only.
    const centerMV = cameraViewMatrix.mul(vec4(uRtcCenter, 1.0));
    const rotated = cameraViewMatrix.mul(vec4(instancePosition, 0.0));
    viewPos = vec4(rotated.xyz.add(centerMV.xyz), 1.0);
    absTransformed = instancePosition.add(uRtcCenter);
  }

  // Lift along the ellipsoid surface normal (view space), then expand the quad.
  const mvHeight = heightOffsetView(absTransformed, instanceHeight);
  const mvPosition = vec4(viewPos.xyz.add(mvHeight), viewPos.w);

  const center = clamp(uCenter, vec2(-0.5), vec2(0.5));
  const rawScale = max(uScale, 0.0);
  const pixelScale = pxToWorld(
    rawScale,
    uFovRad,
    uScreenHeightPx,
    vec3(0.0, 0.0, mvPosition.z),
    vec3(0.0, 0.0, 0.0),
  );
  const finalScale = select(uSizeInMeters, rawScale, pixelScale);
  const quadOffset = positionGeometry.xy
    .sub(center)
    .mul(vec2(uAspect, 1.0))
    .mul(finalScale);
  const mvFinal = vec4(
    mvPosition.xy.add(quadOffset),
    mvPosition.z,
    mvPosition.w,
  );

  const clip = cameraProjectionMatrix.mul(mvFinal);

  // Cull hidden / below-horizon instances by pushing the vertex out of clip space.
  const culled = instanceShow
    .lessThanEqual(0.5)
    .or(horizonCulled(absTransformed, cameraPosition));

  // --- material ---
  const material = new MeshBasicNodeMaterial();
  material.transparent = opts.transparent;
  material.depthTest = opts.depthTest;
  material.vertexNode = select(culled, vec4(2.0, 2.0, 2.0, 1.0), clip);
  // Make positionView carry the expanded view-space position so the shared
  // logarithmic-depth node and screen-space normal resolve against the actual
  // rendered geometry, not the default model-view position.
  material.setupPositionView = () => mvFinal.xyz;

  // MRT slot-0 color: circle mask (discard outside), picking override. Matches
  // the legacy fragment, where the circle alpha only gates discard and the
  // written color stays opaque.
  const spriteColor = Fn(() => {
    const alpha = circleAlpha(uv().sub(0.5));
    Discard(alpha.lessThanEqual(uAlphaTest));
    const base = vec4(instanceColor, 1.0);
    const picked = vec4(nvr_batchIdToColor(instanceBatchID), 1.0);
    return select(uPickable, picked, base);
  })();

  material.colorNode = spriteColor;

  setupNodeMaterialForMRT(
    material,
    {
      colorNode: spriteColor,
      normalNode: screenSpaceNormalView,
      emissiveNode: uEmissiveColor.rgb,
      emissiveIntensityNode: uEmissiveIntensity,
      effectIdsMaskNode: uEffectIdsMask,
    },
    logarithmicDepthBuffer,
  );

  // Re-apply the ellipsoid depth offset (legacy `if (uOffsetDepth) depth -= 0.01`)
  // on top of the shared logarithmic-depth node.
  if (logarithmicDepthBuffer) {
    material.depthNode = logarithmicDepthNode.sub(
      select(uOffsetDepth, float(0.01), float(0.0)),
    );
  }

  return {
    material,
    uniforms: {
      scale: uScale,
      center: uCenter,
      sizeInMeters: uSizeInMeters,
      offsetDepth: uOffsetDepth,
      alphaTest: uAlphaTest,
      aspect: uAspect,
      pickable: uPickable,
      effectIdsMask: uEffectIdsMask,
      emissiveColor: uEmissiveColor,
      emissiveIntensity: uEmissiveIntensity,
      rtcCenter: uRtcCenter,
    },
  };
}

/** Options that select which cached point material to use. */
export type InstancedPointMaterialOptions = {
  useRTE: boolean;
  logarithmicDepthBuffer: boolean;
  transparent: boolean;
  depthTest: boolean;
};

/**
 * Cache of point materials keyed by the material-level state that genuinely
 * cannot be expressed as a per-mesh uniform (RTE/log-depth variants and the
 * GL pipeline state `transparent`/`depthTest`). Bounded to a handful of
 * entries regardless of how many point meshes (tiles) exist, so the UBO
 * binding-point pool is never exhausted. Entries are never disposed — there
 * are only a few and they live for the renderer's lifetime.
 */
const _materialCache = new Map<string, InstancedPointNodeMaterial>();

/** Cache key for {@link getInstancedPointNodeMaterial}. */
export function instancedPointMaterialKey(
  opts: InstancedPointMaterialOptions,
): string {
  return `${opts.useRTE}|${opts.logarithmicDepthBuffer}|${opts.transparent}|${opts.depthTest}`;
}

/**
 * Return the shared point material for the given options, building it on first
 * use. Many {@link InstancedSpriteMesh} instances share each material; per-mesh
 * uniform values are written just-in-time in the mesh's `onBeforeRender`.
 */
export function getInstancedPointNodeMaterial(
  opts: InstancedPointMaterialOptions,
): InstancedPointNodeMaterial {
  const key = instancedPointMaterialKey(opts);
  const cached = _materialCache.get(key);
  if (cached) return cached;
  const created = createInstancedPointNodeMaterial(opts);
  _materialCache.set(key, created);
  return created;
}

/** Material + uniform handles produced by {@link createInstancedPointNodeMaterial}. */
export type InstancedPointNodeMaterial = ReturnType<
  typeof createInstancedPointNodeMaterial
>;
export type InstancedPointMaterialUniforms =
  InstancedPointNodeMaterial["uniforms"];
export type { NodeMaterial };
