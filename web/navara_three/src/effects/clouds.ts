import {
  CLOUD_SHAPE_DETAIL_TEXTURE_SIZE,
  CLOUD_SHAPE_TEXTURE_SIZE,
  CloudsEffect,
  type CloudsQualityPreset,
} from "@takram/three-clouds";
import {
  createData3DTextureLoaderClass,
  parseUint8Array,
  STBNLoader,
} from "@takram/three-geospatial";
import { EffectComposer, EffectPass } from "postprocessing";
import {
  Data3DTexture,
  LinearFilter,
  LinearMipMapLinearFilter,
  NoColorSpace,
  RedFormat,
  RepeatWrapping,
  Texture,
  TextureLoader,
  Vector2,
  type Camera,
} from "three";

import { CLOUD_ASSETS_URL, STBN_URL } from "../constants";

import { Pass, type EffectOptions } from "./effect";

export type CloudsOptions = {
  assetsUrl?: string;
  stbnUrl?: string;
  qualityPreset?: CloudsQualityPreset;
  localWeatherVelocity?: Vector2;
} & EffectOptions;

export const DEFAULT_CLOUDS_OPTIONS: Required<CloudsOptions> = {
  enabled: false,
  index: null,
  assetsUrl: CLOUD_ASSETS_URL,
  stbnUrl: STBN_URL,
  qualityPreset: "medium",
  localWeatherVelocity: new Vector2(),
};

export class Clouds extends Pass<EffectPass, Required<CloudsOptions>> {
  effect: CloudsEffect;
  constructor(
    composer: EffectComposer,
    camera: Camera,
    options?: CloudsOptions,
  ) {
    const effect = new CloudsEffect(camera);
    const pass = new EffectPass(camera, effect);

    super(composer, pass, {
      ...DEFAULT_CLOUDS_OPTIONS,
      ...(options ?? {}),
    });

    this.effect = effect;

    this.onAdded();
  }

  get inner() {
    return this.effect;
  }

  protected onAdded() {
    if (!this.effect) return;

    // TODO: This is a workaround. It should be handled in the library itself.
    this.effect.cloudsPass.currentMaterial.defines.USE_LOGDEPTHBUF = "1";
    this.effect.qualityPreset = this.qualityPreset;
    this.effect.localWeatherVelocity.copy(this.localWeatherVelocity);

    new TextureLoader().load(
      `${this.options.assetsUrl}/local_weather.png`,
      this.onLocalWeatherLoad,
    );
    new (createData3DTextureLoaderClass(parseUint8Array, {
      width: CLOUD_SHAPE_TEXTURE_SIZE,
      height: CLOUD_SHAPE_TEXTURE_SIZE,
      depth: CLOUD_SHAPE_TEXTURE_SIZE,
    }))().load(`${this.options.assetsUrl}/shape.bin`, this.onShapeLoad);
    new (createData3DTextureLoaderClass(parseUint8Array, {
      width: CLOUD_SHAPE_DETAIL_TEXTURE_SIZE,
      height: CLOUD_SHAPE_DETAIL_TEXTURE_SIZE,
      depth: CLOUD_SHAPE_DETAIL_TEXTURE_SIZE,
    }))().load(
      `${this.options.assetsUrl}/shape_detail.bin`,
      this.onShapeDetailLoad,
    );
    new TextureLoader().load(
      `${this.options.assetsUrl}/turbulence.png`,
      this.onTurbulenceLoad,
    );
    new STBNLoader().load(this.options.stbnUrl, this.onSTBNLoad);
  }

  onLocalWeatherLoad = (texture: Texture): void => {
    texture.minFilter = LinearMipMapLinearFilter;
    texture.magFilter = LinearFilter;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.colorSpace = NoColorSpace;
    texture.needsUpdate = true;
    this.effect.localWeatherTexture = texture;
  };

  onShapeLoad = (texture: Data3DTexture): void => {
    texture.format = RedFormat;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.wrapR = RepeatWrapping;
    texture.colorSpace = NoColorSpace;
    texture.needsUpdate = true;
    this.effect.shapeTexture = texture;
  };

  onShapeDetailLoad = (texture: Data3DTexture): void => {
    texture.format = RedFormat;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.wrapR = RepeatWrapping;
    texture.colorSpace = NoColorSpace;
    texture.needsUpdate = true;
    this.effect.shapeDetailTexture = texture;
  };

  onTurbulenceLoad = (texture: Texture): void => {
    texture.minFilter = LinearMipMapLinearFilter;
    texture.magFilter = LinearFilter;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.colorSpace = NoColorSpace;
    texture.needsUpdate = true;
    this.effect.turbulenceTexture = texture;
  };

  onSTBNLoad = (texture: Data3DTexture): void => {
    // TODO
    // aerialPerspective.stbnTexture = texture;
    this.effect.stbnTexture = texture;
  };

  get qualityPreset() {
    return this.options.qualityPreset;
  }
  set qualityPreset(v: CloudsQualityPreset) {
    this.options.qualityPreset = v;
    this.effect.qualityPreset = v;

    this.emit("_needsUpdate");
  }

  get localWeatherVelocity() {
    return this.options.localWeatherVelocity;
  }
  set localWeatherVelocity(v: Vector2) {
    this.options.localWeatherVelocity = v;
    this.effect.localWeatherVelocity.copy(v);

    this.emit("_needsUpdate");
  }
}
