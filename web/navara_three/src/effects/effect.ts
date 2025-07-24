import { EventHandler, type BaseEventMap } from "@navara/core";
import {
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
  E extends PostProcessingEffect | unknown,
  O extends EffectOptions = EffectOptions,
  BaseEv extends BaseEventMap = BaseEventMap,
  Ev extends BaseEventMap & EffectEvents = BaseEv & EffectEvents,
> extends EventHandler<Ev> {
  rawPass: P;
  rawEffect: E;
  protected options: O;

  constructor(pass: P, effect: E, options?: O) {
    super();

    this.rawPass = pass;
    this.rawEffect = effect;

    this.options = { ...(options ?? {}) } as O;

    this.enabled = this.options.enabled ?? DEFAULT_EFFECT_OPTIONS.enabled;

    this.onMounted();
  }

  get raw() {
    return this.rawPass;
  }

  get enabled() {
    return this.options.enabled ?? DEFAULT_EFFECT_OPTIONS.enabled;
  }
  set enabled(v: boolean) {
    this.options.enabled = v;
    this.rawPass.enabled = v;

    this.emit(
      "_needsUpdate",
      // I'm not sure why we need this cast, but it is necessary actually.
      ...([] as Parameters<Ev["_needsUpdate"]>),
    );
  }

  get visible() {
    return this.enabled;
  }
  set visible(v: boolean) {
    this.enabled = v;
  }

  protected onMounted() {}

  dispose() {
    this.rawPass.dispose();
  }
}

export class Effect<
  E extends PostProcessingEffect,
  O extends EffectOptions = EffectOptions,
  Ev extends EffectEvents = EffectEvents,
> extends Pass<EffectPass, E, O, Ev> {
  constructor(camera: Camera, effect: E, options?: O) {
    const pass = new EffectPass(camera, effect);

    super(pass, effect, options);
  }
}
