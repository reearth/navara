import { BlendFunction } from "postprocessing";
import type { Camera, Texture } from "three";

import { Effect, type EffectOptions } from "../effect";

import {
  OutlineEffect as OutlineEffectImpl,
  outlineEffectOptionsDefaults,
} from "./OutlineEffect";

export type OutlineOptions = {
  /** Blend function for compositing the outline */
  blendFunction?: BlendFunction;
  /** Opacity of the outline effect */
  opacity?: number;
  /** Normal buffer texture for edge detection */
  normalBuffer?: Texture | null;
  /** Thickness of depth-based outline detection */
  depthOutlineThickness?: number;
  /** Bias for depth-based outline detection */
  depthBias?: number;
  /** Thickness of normal-based outline detection */
  normalOutlineThickness?: number;
  /** Bias for normal-based outline detection */
  normalBias?: number;
} & EffectOptions;

export const DEFAULT_OUTLINE_OPTIONS: Required<OutlineOptions> = {
  enabled: false,
  blendFunction: outlineEffectOptionsDefaults.blendFunction,
  opacity: outlineEffectOptionsDefaults.opacity,
  normalBuffer: null,
  depthOutlineThickness: outlineEffectOptionsDefaults.depthOutlineThickness,
  depthBias: outlineEffectOptionsDefaults.depthBias,
  normalOutlineThickness: outlineEffectOptionsDefaults.normalOutlineThickness,
  normalBias: outlineEffectOptionsDefaults.normalBias,
};

export class Outline extends Effect<OutlineEffectImpl, OutlineOptions> {
  constructor(camera: Camera, _options: OutlineOptions = {}) {
    const options = { ...DEFAULT_OUTLINE_OPTIONS, ..._options };

    const effect = new OutlineEffectImpl({
      blendFunction: options.blendFunction,
      normalBuffer: options.normalBuffer,
      opacity: options.opacity,
      depthOutlineThickness: options.depthOutlineThickness,
      depthBias: options.depthBias,
      normalOutlineThickness: options.normalOutlineThickness,
      normalBias: options.normalBias,
    });

    super(camera, effect, options);
  }

  // Getters and setters for outline properties
  get normalBuffer() {
    return this.options.normalBuffer ?? DEFAULT_OUTLINE_OPTIONS.normalBuffer;
  }
  set normalBuffer(v: Texture | null) {
    if (this.options.normalBuffer === v) return;
    this.options.normalBuffer = v;
    if (!this.rawEffect) return;
    this.rawEffect.normalBuffer = v;
    this.emit("_needsUpdate");
  }

  get opacity() {
    return this.options.opacity ?? DEFAULT_OUTLINE_OPTIONS.opacity;
  }
  set opacity(v: number) {
    if (this.options.opacity === v) return;
    this.options.opacity = v;
    if (!this.rawEffect) return;
    this.rawEffect.opacity = v;
    this.emit("_needsUpdate");
  }

  get blendFunction() {
    return this.options.blendFunction ?? DEFAULT_OUTLINE_OPTIONS.blendFunction;
  }
  set blendFunction(v: BlendFunction) {
    if (this.options.blendFunction === v) return;
    this.options.blendFunction = v;
    // BlendFunction is set in constructor and cannot be changed dynamically
    this.emit("_needsUpdate");
  }

  get depthOutlineThickness() {
    return (
      this.options.depthOutlineThickness ??
      DEFAULT_OUTLINE_OPTIONS.depthOutlineThickness
    );
  }
  set depthOutlineThickness(v: number) {
    if (this.options.depthOutlineThickness === v) return;
    this.options.depthOutlineThickness = v;
    if (!this.rawEffect) return;
    this.rawEffect.depthOutlineThickness = v;
    this.emit("_needsUpdate");
  }

  get depthBias() {
    return this.options.depthBias ?? DEFAULT_OUTLINE_OPTIONS.depthBias;
  }
  set depthBias(v: number) {
    if (this.options.depthBias === v) return;
    this.options.depthBias = v;
    if (!this.rawEffect) return;
    this.rawEffect.depthBias = v;
    this.emit("_needsUpdate");
  }

  get normalOutlineThickness() {
    return (
      this.options.normalOutlineThickness ??
      DEFAULT_OUTLINE_OPTIONS.normalOutlineThickness
    );
  }
  set normalOutlineThickness(v: number) {
    if (this.options.normalOutlineThickness === v) return;
    this.options.normalOutlineThickness = v;
    if (!this.rawEffect) return;
    this.rawEffect.normalOutlineThickness = v;
    this.emit("_needsUpdate");
  }

  get normalBias() {
    return this.options.normalBias ?? DEFAULT_OUTLINE_OPTIONS.normalBias;
  }
  set normalBias(v: number) {
    if (this.options.normalBias === v) return;
    this.options.normalBias = v;
    if (!this.rawEffect) return;
    this.rawEffect.normalBias = v;
    this.emit("_needsUpdate");
  }
}
