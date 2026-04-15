import { Unimplemented } from "@navara/core";
import { Object3D, type Vector2 } from "three";

// Interface for pickable mesh.
export class PickableMesh {
  _setPickable(_pickable: boolean, _pickingCoord?: Vector2) {
    throw new Unimplemented();
  }

  /**
   * Returns the underlying Object3D that actually gets rendered for this
   * pickable entry. Picking wrappers are bookkeeping objects and are not
   * themselves added to any scene — the renderable is what lives in the
   * opaque scene and must be visible during the pick pass.
   */
  _getRenderable(): Object3D {
    throw new Unimplemented();
  }
}

export const isPickableMesh = (v: object): v is PickableMesh => {
  return "_setPickable" in v;
};
