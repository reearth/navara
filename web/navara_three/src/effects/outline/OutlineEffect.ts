// Research and development by https://github.com/takram-design-engineering

import fragmentShader from "@shaders/glsl/outlineEffect.frag.glsl?raw";
import { resolveIncludes, type UniformMap } from "@takram/three-geospatial";
import { depth, math, packing } from "@takram/three-geospatial/shaders";
import { BlendFunction, Effect, EffectAttribute } from "postprocessing";
import { Uniform, type Texture } from "three";

export type OutlineEffectOptions = {
  blendFunction?: BlendFunction;
  normalBuffer?: Texture | null;
  opacity?: number;
  depthOutlineThickness?: number;
  depthBias?: number;
  normalOutlineThickness?: number;
  normalBias?: number;
};

export type OutlineEffectUniforms = {
  normalBuffer: Uniform<Texture | null>;
  opacity: Uniform<number>;
  depthOutlineThickness: Uniform<number>;
  depthBias: Uniform<number>;
  normalOutlineThickness: Uniform<number>;
  normalBias: Uniform<number>;
};

export const outlineEffectOptionsDefaults = {
  blendFunction: BlendFunction.NORMAL,
  opacity: 1,
  depthOutlineThickness: 1.0,
  depthBias: 100.0,
  normalOutlineThickness: 1.0,
  normalBias: 1.0,
} satisfies OutlineEffectOptions;

export class OutlineEffect extends Effect {
  declare uniforms: UniformMap<OutlineEffectUniforms>;

  constructor(options?: OutlineEffectOptions) {
    const {
      blendFunction,
      normalBuffer,
      opacity,
      depthOutlineThickness,
      depthBias,
      normalOutlineThickness,
      normalBias,
    } = {
      ...outlineEffectOptionsDefaults,
      ...options,
    };
    super(
      "OutlineEffect",
      resolveIncludes(fragmentShader, {
        core: {
          depth,
          packing,
          math,
        },
      }),
      {
        blendFunction,
        attributes: EffectAttribute.CONVOLUTION | EffectAttribute.DEPTH,
        uniforms: new Map<string, Uniform>(
          Object.entries({
            normalBuffer: new Uniform(normalBuffer ?? null),
            opacity: new Uniform(opacity ?? 1),
            depthOutlineThickness: new Uniform(depthOutlineThickness ?? 1.0),
            depthBias: new Uniform(depthBias ?? 100.0),
            normalOutlineThickness: new Uniform(normalOutlineThickness ?? 1.0),
            normalBias: new Uniform(normalBias ?? 1.0),
          } satisfies OutlineEffectUniforms),
        ),
      },
    );
  }

  get normalBuffer(): Texture | null {
    return this.uniforms.get("normalBuffer").value;
  }

  set normalBuffer(value: Texture | null) {
    this.uniforms.get("normalBuffer").value = value;
  }

  get opacity(): number {
    return this.uniforms.get("opacity").value;
  }

  set opacity(value: number) {
    this.uniforms.get("opacity").value = value;
  }

  get depthOutlineThickness(): number {
    return this.uniforms.get("depthOutlineThickness").value;
  }

  set depthOutlineThickness(value: number) {
    this.uniforms.get("depthOutlineThickness").value = value;
  }

  get depthBias(): number {
    return this.uniforms.get("depthBias").value;
  }

  set depthBias(value: number) {
    this.uniforms.get("depthBias").value = value;
  }

  get normalOutlineThickness(): number {
    return this.uniforms.get("normalOutlineThickness").value;
  }

  set normalOutlineThickness(value: number) {
    this.uniforms.get("normalOutlineThickness").value = value;
  }

  get normalBias(): number {
    return this.uniforms.get("normalBias").value;
  }

  set normalBias(value: number) {
    this.uniforms.get("normalBias").value = value;
  }
}
