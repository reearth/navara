import { EventHandler } from "@navara/core";
import {
  EffectComposer,
  EffectPass,
  Effect as PostProcessingEffect,
  Pass as PostProcessingPass,
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

export class Pass<
  P extends PostProcessingPass,
  O extends EffectOptions = EffectOptions,
> extends EventHandler<EffectEvents> {
  private composer: EffectComposer;
  protected pass: P;
  protected options: O;

  constructor(composer: EffectComposer, pass: P, options?: O) {
    super();

    this.composer = composer;
    this.pass = pass;
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

export class Effect<
  E extends PostProcessingEffect,
  O extends EffectOptions = EffectOptions,
> extends Pass<EffectPass, O> {
  protected effect: E;

  constructor(
    composer: EffectComposer,
    camera: Camera,
    effectConstructor: new () => E,
    options?: O,
  ) {
    const effect = new effectConstructor();
    const pass = new EffectPass(camera, effect);

    super(composer, pass, options);

    this.effect = effect;
  }
}
