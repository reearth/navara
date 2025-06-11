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
  index?: number | null | undefined;
};

export const DEFAULT_EFFECT_OPTIONS: Required<EffectOptions> = {
  enabled: false,
  index: null,
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

  constructor(composer: EffectComposer, pass?: P, options?: O) {
    super();

    this.composer = composer;
    this.options = { ...(options ?? {}) } as O;

    this.set(pass);
  }

  get enabled() {
    return this.options.enabled ?? DEFAULT_EFFECT_OPTIONS.enabled;
  }
  set enabled(v: boolean) {
    if (this.options.enabled === v) return;
    this.options.enabled = v;

    if (!this.pass) {
      if (v) {
        this.onMounted();
      } else {
        this.set();
      }
    }

    if (!this.pass) return;

    this.pass.enabled = v;

    if (!this.composer.passes.includes(this.pass)) {
      this.set(this.pass);
    }

    this.emit("_needsUpdate");
  }

  // TODO: Add setter
  get index() {
    return this.options.index ?? undefined;
  }

  protected onAdded() {}

  protected onMounted() {}

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

  dispose() {
    if (!this.pass) return;
    this.composer.removePass(this.pass);
    this.pass.dispose();
    this.pass = undefined;
  }
}

export class Effect<
  E extends PostProcessingEffect,
  O extends EffectOptions = EffectOptions,
> extends Pass<EffectPass, O> {
  protected effect?: E;
  private effectConstructor: new () => E;
  private camera: Camera;

  constructor(
    composer: EffectComposer,
    camera: Camera,
    effectConstructor: new () => E,
    options?: O,
  ) {
    const effect = options?.enabled ? new effectConstructor() : undefined;
    const pass = effect ? new EffectPass(camera, effect) : undefined;

    super(composer, pass, options);

    this.effect = effect;
    this.effectConstructor = effectConstructor;
    this.camera = camera;
  }

  protected onMounted() {
    const effect = new this.effectConstructor();
    this.effect = effect;
    this.pass = new EffectPass(this.camera, effect);
  }
}
