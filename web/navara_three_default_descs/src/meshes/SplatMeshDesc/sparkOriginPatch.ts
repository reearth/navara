import type { SparkRenderer } from "@sparkjsdev/spark";
import { PerspectiveCamera, Quaternion, Vector3 } from "three";

/**
 * Floating-origin ("RTC") patch for SparkJS at globe (ECEF) scale.
 *
 * ## Why
 * Spark bakes each splat into its accumulator with a GPU expression
 * `centerSubView = worldCenter - viewOrigin`, where `viewOrigin` is the camera
 * world position. At ECEF scale both operands are ~6.4e6, so in float32 they
 * each carry ~0.4 m of rounding error and the subtraction loses it
 * (catastrophic cancellation): the baked center gains ~0.5 m of error. That
 * error is re-randomized every time Spark re-sorts (i.e. as the camera moves),
 * which reads as sub-meter jitter/popping. The lossy subtraction lives inside
 * Spark's generated (dyno) shader, so it cannot be fixed with a uniform value.
 *
 * ## Fix
 * Never let Spark see ECEF coordinates. We pick a per-renderer origin `O` near
 * the splats and:
 *   1. place each SplatMesh's `matrixWorld` relative to `O` (done in
 *      SplatMeshDesc, on the CPU in float64), so the generator produces small
 *      `worldCenter`s; and
 *   2. feed Spark a proxy camera shifted by `-O` (here), so `viewOrigin` and
 *      the view transform are small too.
 * Then `worldCenter - viewOrigin` is `small - small` → precise. The rendered
 * result is unchanged: the splat vertex shader positions splats purely from
 * Spark's own view-space uniforms (`renderToViewPos/Quat/Basis`) plus
 * `projectionMatrix`, never a camera view matrix, and view space is
 * camera-relative — so translating both world and camera by `O` cancels.
 *
 * The origin is read from `renderer.userData[ORIGIN_KEY]`; renderers without it
 * are left completely untouched, so this is inert for non-georeferenced scenes.
 *
 * ## Dynamic origin
 * `O` is not fixed: `renderer.userData[ORIGIN_UPDATER]`, if present, is called
 * every frame with the real camera *before* the origin is read. It grid-snaps
 * the origin to the camera and, when it moves to a new cell, recenters every
 * splat mesh — so whatever the camera looks at is always near `O` and precise,
 * while distant splats keep only sub-pixel error. See {@link splatOriginController}.
 */
export const ORIGIN_KEY = "navaraSplatOrigin";
export const ORIGIN_UPDATER = "navaraSplatOriginUpdater";

/** Per-renderer hook that advances the dynamic origin for the given camera. */
export type OriginUpdater = (camera: PerspectiveCamera) => void;

/** Marker on the prototype so HMR re-imports don't wrap `onBeforeRender` twice. */
const PATCH_MARKER = "__navaraOriginPatched";

/**
 * @param SparkRendererClass - The (lazily loaded) SparkRenderer class; taken
 *   as an argument so this module needs no static import of
 *   `@sparkjsdev/spark` (see the loader in SplatMeshDesc/index.ts).
 */
export function ensureSparkOriginPatch(
  SparkRendererClass: typeof SparkRenderer,
): void {
  const proto = SparkRendererClass.prototype as unknown as {
    onBeforeRender: (
      renderer: unknown,
      scene: unknown,
      camera: unknown,
    ) => void;
    [PATCH_MARKER]?: boolean;
  };
  if (proto[PATCH_MARKER]) return;
  proto[PATCH_MARKER] = true;

  const original = proto.onBeforeRender;

  // One reusable proxy; Spark reads it synchronously (and, on its deferred
  // accumulation path, ~1 tick later) so a single shifted snapshot is enough.
  const proxy = new PerspectiveCamera();
  const worldPos = new Vector3();
  const worldQuat = new Quaternion();

  type SparkLike = { userData?: Record<string, unknown> };

  proto.onBeforeRender = function patchedOnBeforeRender(
    this: SparkLike,
    renderer: unknown,
    scene: unknown,
    camera: unknown,
  ) {
    // `sparkOverride` is the instance actually driving accumulation/draw.
    const spark =
      (SparkRendererClass as unknown as { sparkOverride?: SparkLike })
        .sparkOverride ?? this;
    const cam = camera as PerspectiveCamera;

    // Advance the dynamic origin (grid-snap to camera, recenter meshes on cell
    // change) before reading it, so proxy camera and mesh coords stay in sync.
    (spark?.userData?.[ORIGIN_UPDATER] as OriginUpdater | undefined)?.(cam);

    const origin = spark?.userData?.[ORIGIN_KEY] as Vector3 | undefined;
    if (!origin) {
      original.call(this, renderer, scene, camera);
      return;
    }

    cam.getWorldPosition(worldPos);
    cam.getWorldQuaternion(worldQuat);
    proxy.position.copy(worldPos).sub(origin);
    proxy.quaternion.copy(worldQuat);
    proxy.near = cam.near;
    proxy.far = cam.far;
    proxy.projectionMatrix.copy(cam.projectionMatrix);
    proxy.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
    // Rebuild matrixWorld from the shifted position/quaternion so Spark's own
    // `camera.updateMatrixWorld()` call cannot clobber the shift.
    proxy.updateMatrixWorld(true);

    original.call(this, renderer, scene, proxy);
  };
}
