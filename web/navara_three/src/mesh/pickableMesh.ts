import { Unimplemented } from "@navara/core";

// Interface for feature's mesh.
export class PickableMesh {
  _setPickable(_pickable: boolean) {
    throw new Unimplemented();
  }
}

export const isPickableMesh = (v: object): v is PickableMesh => {
  return "_setPickable" in v;
};
