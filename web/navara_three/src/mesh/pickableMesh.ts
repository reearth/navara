import { Unimplemented } from "@navara/core";
import { Object3D, type Vector2 } from "three";

/**
 * Contract for an object that participates in GPU picking.
 *
 * Implementers must provide {@link onBeforePicking}, {@link onAfterPicking},
 * and {@link _getRenderable}. Register an instance via
 * `ViewContext.registerPickableMesh` so the pick pass can discover it.
 *
 * Navara does NOT rewrite your shaders. While the two hooks are active, your
 * material must output the encoded `batchId` as the flat final color — how
 * that is achieved is your concern. For a turnkey implementation over stock
 * Three.js materials see {@link PickableMeshWrapper}; for `InstancedMesh` see
 * {@link PickableInstancedMeshWrapper}.
 *
 * This class is a loose base: classes that already extend a Three.js type
 * (`Mesh`, `Group`, etc.) may `implement` it instead of `extend`-ing it —
 * {@link isPickableMesh} uses a structural check rather than `instanceof`.
 */
export class PickableMesh {
  /**
   * Fired immediately before the pick pass renders this entry. Configure
   * your material so the next draw outputs the encoded `batchId` as
   * `gl_FragColor`.
   */
  onBeforePicking(_pickingCoord?: Vector2): void {
    throw new Unimplemented();
  }

  /** Fired immediately after the pick pass completes. Restore normal rendering. */
  onAfterPicking(): void {
    throw new Unimplemented();
  }

  /**
   * The Object3D to re-parent into the pick scene for the picking render.
   * The wrapper itself is bookkeeping and is never added to a scene.
   */
  _getRenderable(): Object3D {
    throw new Unimplemented();
  }
}

export const isPickableMesh = (v: object): v is PickableMesh =>
  "onBeforePicking" in v;
