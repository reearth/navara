import {
  EffectLayerDeclaration,
  type EffectLayerConfig,
  type EffectLayerUpdate,
} from "../../core/EffectLayerDeclaration";
import { CopyPass } from "../../effects";

type LayerDescription = {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  final?: {};
};

export type FinalCopyPassConfig = LayerDescription & EffectLayerConfig;

export type FinalCopyPassUpdate = LayerDescription & EffectLayerUpdate;

export class FinalCopyEffectLayer extends EffectLayerDeclaration<
  FinalCopyPassConfig,
  FinalCopyPassUpdate,
  CopyPass
> {
  static key = "final";

  createPass() {
    const pass = new CopyPass();

    return pass;
  }
}
