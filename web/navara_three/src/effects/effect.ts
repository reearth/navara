import { EventHandler } from "@navara/core";
import {
  EffectComposer,
  EffectPass,
  Effect as PostProcessingEffect,
} from "postprocessing";
import type { Camera } from "three";

export type EffectOptions = {
  enabled?: boolean;
};

export const DEFAULT_EFFECT_OPTIONS: Required<EffectOptions> = {
  enabled: false,
};

export type EffectEvents = {
  _needsUpdate: () => void;
};

export class Effect<
  E extends PostProcessingEffect,
  O extends EffectOptions = EffectOptions,
> extends EventHandler<EffectEvents> {
  composer: EffectComposer;
  camera: Camera;
  protected effect: E;
  private pass: EffectPass;
  protected options: O;

  constructor(
    composer: EffectComposer,
    camera: Camera,
    effectConstructor: new () => E,
    options?: O,
  ) {
    super();

    this.composer = composer;
    this.camera = camera;
    this.effect = new effectConstructor();
    this.pass = new EffectPass(this.camera, this.effect);
    this.options = { ...(options ?? {}) } as O;

    this.composer.addPass(this.pass);

    this.pass.enabled = this.enabled;
  }

  get enabled() {
    return this.options.enabled ?? DEFAULT_EFFECT_OPTIONS.enabled;
  }
  set enabled(v: boolean) {
    if (this.options.enabled === v) return;
    this.options.enabled = v;
    this.pass.enabled = v;
    this.emit("_needsUpdate");
  }
}
