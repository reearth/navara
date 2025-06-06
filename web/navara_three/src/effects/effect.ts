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
  protected pass?: P;
  protected options: O;
  // TODO: Update the index dynamically.
  index?: number;

  constructor(composer: EffectComposer, pass?: P, options?: O, index?: number) {
    super();

    this.composer = composer;
    this.options = { ...(options ?? {}) } as O;
    this.index = index;

    this.set(pass);
  }

  get enabled() {
    return this.options.enabled ?? DEFAULT_EFFECT_OPTIONS.enabled;
  }
  set enabled(v: boolean) {
    if (this.options.enabled === v) return;
    this.options.enabled = v;

    if (!this.pass) return;
    this.pass.enabled = v;

    this.emit("_needsUpdate");
  }

  protected onAdded() {}

  protected set(pass?: P) {
    if (this.pass) {
      this.composer.removePass(this.pass);
    }

    this.pass = pass;
    if (this.pass) {
      this.composer.addPass(this.pass, this.index);
      this.pass.enabled = this.enabled;
      this.onAdded();
    }
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
