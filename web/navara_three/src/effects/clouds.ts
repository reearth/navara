import {
  CLOUD_SHAPE_DETAIL_TEXTURE_SIZE,
  CLOUD_SHAPE_TEXTURE_SIZE,
  CloudLayer,
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
  coverage?: number;
  lightShaft?: boolean | null | undefined;
  resolutionScale?: number;

  maxIterationCount?: number;
  minStepSize?: number;
  maxStepSize?: number;

  // Whether enabling the shadow for all layers or not.
  shadows?: boolean;
  shadowCascadeCount?: number;
  shadowMapSize?: Vector2;
  shadowFarScale?: number;
} & EffectOptions;

// Default value is based on the medium preset.
export const DEFAULT_CLOUDS_OPTIONS: Required<CloudsOptions> = {
  enabled: false,
  index: null,
  assetsUrl: CLOUD_ASSETS_URL,
  stbnUrl: STBN_URL,
  qualityPreset: "medium",
  localWeatherVelocity: new Vector2(),
  coverage: 0.25,
  lightShaft: null,
  resolutionScale: 1,

  maxIterationCount: 500,
  minStepSize: 100,
  maxStepSize: 1000,

  shadows: true,
  shadowCascadeCount: 3,
  shadowMapSize: new Vector2(512, 512),
  shadowFarScale: 0.00025,
};

// TODO: Clouds are constructed temporally, so rendering a frame depends on a request might not be a good way.
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

    this.effect.qualityPreset = this.qualityPreset;
    this.effect.localWeatherVelocity.copy(this.localWeatherVelocity);
    this.effect.resolutionScale = this.resolutionScale;

    if (this.options.lightShaft != null) {
      this.effect.lightShafts = this.lightShaft;
    }
    this.effect.coverage = this.coverage;

    this.effect.shadow.farScale = this.shadowFarScale;
    this.effect.shadow.mapSize = this.shadowMapSize;
    this.effect.shadow.cascadeCount = this.shadowCascadeCount;

    this.forEachLayers((l) => {
      l.shadow = this.shadows;
    });

    this.loadAll().then(() => {
      this.emit("_needsUpdate");
    });
  }

  private forEachLayers(cb: (l: CloudLayer) => void) {
    this.effect.cloudLayers.forEach(cb);
  }

  loadAll() {
    return Promise.all([
      new TextureLoader()
        .loadAsync(`${this.options.assetsUrl}/local_weather.png`)
        .then(this.onLocalWeatherLoad),
      new (createData3DTextureLoaderClass(parseUint8Array, {
        width: CLOUD_SHAPE_TEXTURE_SIZE,
        height: CLOUD_SHAPE_TEXTURE_SIZE,
        depth: CLOUD_SHAPE_TEXTURE_SIZE,
      }))()
        .loadAsync(`${this.options.assetsUrl}/shape.bin`)
        .then(this.onShapeLoad),
      new (createData3DTextureLoaderClass(parseUint8Array, {
        width: CLOUD_SHAPE_DETAIL_TEXTURE_SIZE,
        height: CLOUD_SHAPE_DETAIL_TEXTURE_SIZE,
        depth: CLOUD_SHAPE_DETAIL_TEXTURE_SIZE,
      }))()
        .loadAsync(`${this.options.assetsUrl}/shape_detail.bin`)
        .then(this.onShapeDetailLoad),
      new TextureLoader()
        .loadAsync(`${this.options.assetsUrl}/turbulence.png`)
        .then(this.onTurbulenceLoad),
      new STBNLoader().loadAsync(this.options.stbnUrl).then(this.onSTBNLoad),
    ]);
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

  get coverage() {
    return this.options.coverage;
  }
  set coverage(v: number) {
    this.options.coverage = v;
    this.effect.coverage = v;

    this.emit("_needsUpdate");
  }

  get lightShaft() {
    return !!this.options.lightShaft;
  }
  set lightShaft(v: boolean) {
    this.options.lightShaft = v;
    this.effect.lightShafts = v;

    this.emit("_needsUpdate");
  }

  get resolutionScale() {
    return this.options.resolutionScale;
  }
  set resolutionScale(v: number) {
    this.options.resolutionScale = v;
    this.effect.resolutionScale = v;
    this.emit("_needsUpdate");
  }

  get maxIterationCount() {
    return this.options.maxIterationCount;
  }
  set maxIterationCount(v: number) {
    this.options.maxIterationCount = v;
    this.effect.clouds.maxIterationCount = v;
    this.emit("_needsUpdate");
  }

  get minStepSize() {
    return this.options.minStepSize;
  }
  set minStepSize(v: number) {
    this.options.minStepSize = v;
    this.effect.clouds.minStepSize = v;
    this.emit("_needsUpdate");
  }

  get maxStepSize() {
    return this.options.maxStepSize;
  }
  set maxStepSize(v: number) {
    this.options.maxStepSize = v;
    this.effect.clouds.maxStepSize = v;
    this.emit("_needsUpdate");
  }

  get shadows() {
    return this.options.shadows;
  }
  set shadows(v: boolean) {
    this.options.shadows = v;
    this.forEachLayers((l) => {
      l.shadow = v;
    });

    this.emit("_needsUpdate");
  }

  get shadowCascadeCount() {
    return this.options.shadowCascadeCount;
  }
  set shadowCascadeCount(v: number) {
    this.options.shadowCascadeCount = v;
    this.effect.shadow.cascadeCount = v;

    this.emit("_needsUpdate");
  }

  get shadowMapSize() {
    return this.options.shadowMapSize;
  }
  set shadowMapSize(v: Vector2) {
    this.options.shadowMapSize = v;
    this.effect.shadow.mapSize = v;

    this.emit("_needsUpdate");
  }

  get shadowFarScale() {
    return this.options.shadowFarScale;
  }
  set shadowFarScale(v: number) {
    this.options.shadowFarScale = v;
    this.effect.shadow.farScale = v;

    this.emit("_needsUpdate");
  }
}
