import type { SplatMesh } from "@sparkjsdev/spark";
import { Matrix4, PerspectiveCamera, Vector3 } from "three";

/**
 * Drives the dynamic floating-origin ("RTC") for one shared SparkRenderer.
 *
 * The origin `O` follows the camera, snapped to a coarse grid so it only moves
 * when the camera crosses a cell. On each move every registered splat mesh is
 * recentered to the new `O` (recomputed from its stored ECEF matrix, on the CPU
 * in float64) and {@link sparkOriginPatch} feeds Spark a camera shifted by `-O`.
 * The net world placement is unchanged — only the magnitude of the coordinates
 * Spark's float32 accumulation shader sees, which is what removes the jitter.
 *
 * Precision: a splat's residual jitter is ~`|splat - camera| * 2^-23`, i.e.
 * proportional to how far away it is on screen — so near splats are exact and
 * far ones jitter sub-pixel, regardless of absolute ECEF position.
 */
export class SplatOriginController {
  /** Current origin (also referenced by the patch via renderer.userData). */
  readonly origin = new Vector3();
  private hasOrigin = false;
  /** Registered meshes → their original ECEF world matrix. */
  private readonly meshes = new Map<SplatMesh, Matrix4>();

  private readonly cameraPos = new Vector3();
  private readonly snapped = new Vector3();
  private readonly translation = new Matrix4();

  /**
   * @param cellSize Grid cell edge in metres. Smaller = tighter precision near
   *   the camera but more frequent re-accumulation as cells are crossed.
   */
  constructor(private readonly cellSize: number) {}

  register(mesh: SplatMesh, ecefMatrix: Matrix4): void {
    this.meshes.set(mesh, ecefMatrix);
    // If an origin is already established, place the newcomer immediately so it
    // is correct on its very first frame instead of one frame at ECEF scale.
    if (this.hasOrigin) this.recenter(mesh, ecefMatrix);
  }

  unregister(mesh: SplatMesh): void {
    this.meshes.delete(mesh);
  }

  /** Called every frame by the patch, before the origin is read. */
  readonly update = (camera: PerspectiveCamera): void => {
    camera.getWorldPosition(this.cameraPos);
    const cell = this.cellSize;
    this.snapped.set(
      Math.round(this.cameraPos.x / cell) * cell,
      Math.round(this.cameraPos.y / cell) * cell,
      Math.round(this.cameraPos.z / cell) * cell,
    );
    if (this.hasOrigin && this.snapped.equals(this.origin)) return;

    this.origin.copy(this.snapped);
    this.hasOrigin = true;
    for (const [mesh, ecef] of this.meshes) this.recenter(mesh, ecef);
  };

  /** mesh.matrixWorld = translate(-origin) · ecef (frozen; base already did too). */
  private recenter(mesh: SplatMesh, ecef: Matrix4): void {
    mesh.matrixAutoUpdate = false;
    mesh.matrixWorldAutoUpdate = false;
    this.translation.makeTranslation(
      -this.origin.x,
      -this.origin.y,
      -this.origin.z,
    );
    mesh.matrixWorld.multiplyMatrices(this.translation, ecef);
  }
}
