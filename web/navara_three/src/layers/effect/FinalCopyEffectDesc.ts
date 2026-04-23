import {
  EffectDesc,
  type EffectConfig,
  type EffectUpdate,
} from "../../core/EffectDesc";
import { CopyPass } from "../../effects";

type Description = {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  final?: {};
};

export type FinalCopyPassConfig = Description & EffectConfig;

export type FinalCopyPassUpdate = Description & EffectUpdate;

export class FinalCopyEffectDesc extends EffectDesc<
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
