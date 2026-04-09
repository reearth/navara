import {
  EffectDeclaration,
  type EffectConfig,
  type EffectUpdate,
} from "../../core/EffectDeclaration";
import { CopyPass } from "../../effects";

type LayerDescription = {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  final?: {};
};

export type FinalCopyPassConfig = LayerDescription & EffectConfig;

export type FinalCopyPassUpdate = LayerDescription & EffectUpdate;

export class FinalCopyEffectDeclaration extends EffectDeclaration<
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
