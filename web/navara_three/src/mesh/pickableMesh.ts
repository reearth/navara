import { Unimplemented } from "@navara/core";
import { Vector2 } from "three";

// Interface for pickable mesh.
export class PickableMesh {
  _setPickable(_pickable: boolean, _pickingCoord?: Vector2) {
    throw new Unimplemented();
  }
}

export const isPickableMesh = (v: object): v is PickableMesh => {
  return "_setPickable" in v;
};
