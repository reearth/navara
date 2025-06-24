import type { Nullable } from "@navara/core";
import {
  CLOUD_SHAPE_DETAIL_TEXTURE_SIZE,
  CLOUD_SHAPE_TEXTURE_SIZE,
  CloudLayer as CloudLayerImpl,
  CloudLayers,
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
  Vector3,
  type Camera,
} from "three";

import { CloudLayer, type CloudLayerOptions } from "../clouds";
import { CLOUD_ASSETS_URL, STBN_URL } from "../constants";

import { Pass, type EffectOptions } from "./effect";

export type CloudsOptions = {
  assetsUrl?: string;
  stbnUrl?: string;
  qualityPreset?: CloudsQualityPreset;
  localWeatherVelocity?: Vector2;
  coverage?: number;
  lightShafts?: Nullable<boolean>;

  // Processing
  maxIterationCount?: Nullable<number>;
  minStepSize?: Nullable<number>;
  maxStepSize?: Nullable<number>;
  resolutionScale?: number;

  // Whether enabling the shadow for all layers or not.
  shadows?: boolean;
  shadowCascadeCount?: number;
  shadowMapSize?: Vector2;
  shadowFarScale?: number;

  // Haze
  haze?: boolean;
  hazeDensityScale?: number;
  hazeExponent?: number;
  hazeScatteringCoefficient?: number;
  hazeAbsorptionCoefficient?: number;

  // Weather and shape
  localWeatherRepeat?: Vector2;
  localWeatherOffset?: Vector2;
  shapeRepeat?: Vector3;
  shapeOffset?: Vector3;
  shapeDetailRepeat?: Vector3;
  shapeDetailOffset?: Vector3;
  turbulenceRepeat?: Vector2;
  turbulenceDisplacement?: number;

  // Scattering
  scatteringCoefficient?: number;
  absorptionCoefficient?: number;
  scatterAnisotropy1?: number;
  scatterAnisotropy2?: number;
  scatterAnisotropyMix?: number;
  skyIrradianceScale?: number;
  groundIrradianceScale?: number;
  powderScale?: number;
  powderExponent?: number;

  cloudLayers?: Nullable<CloudLayerOptions[]>;
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
  lightShafts: null,
  resolutionScale: 1,

  maxIterationCount: null,
  minStepSize: null,
  maxStepSize: null,

  shadows: true,
  shadowCascadeCount: 3,
  shadowMapSize: new Vector2(512, 512),
  shadowFarScale: 0.0025,

  haze: true,
  hazeDensityScale: 3e-5,
  hazeExponent: 1e-3,
  hazeScatteringCoefficient: 0.9,
  hazeAbsorptionCoefficient: 0.5,

  localWeatherRepeat: new Vector2().setScalar(100),
  localWeatherOffset: new Vector2(),
  shapeRepeat: new Vector3().setScalar(0.0003),
  shapeOffset: new Vector3(),
  shapeDetailRepeat: new Vector3().setScalar(0.006),
  shapeDetailOffset: new Vector3(),
  turbulenceRepeat: new Vector2().setScalar(20),
  turbulenceDisplacement: 350,

  scatteringCoefficient: 1,
  absorptionCoefficient: 0,
  scatterAnisotropy1: 0.7,
  scatterAnisotropy2: -0.2,
  scatterAnisotropyMix: 0.5,
  skyIrradianceScale: 1,
  groundIrradianceScale: 1,
  powderScale: 0.8,
  powderExponent: 150,

  cloudLayers: null,
};

export class Clouds extends Pass<EffectPass, Required<CloudsOptions>> {
  effect: CloudsEffect;
  private _cloudLayers: CloudLayer[] = [];

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

    this.initializeCloudLayers(options?.cloudLayers ?? undefined);

    this.onAdded();
  }

  initializeCloudLayers(options?: CloudLayerOptions[]) {
    const layers = [
      new CloudLayer(CloudLayers.DEFAULT[0], options?.[0]),
      new CloudLayer(CloudLayers.DEFAULT[1], options?.[1]),
      new CloudLayer(CloudLayers.DEFAULT[2], options?.[2]),
      new CloudLayer(CloudLayers.DEFAULT[3], options?.[3]),
    ];

    for (let i = 0; i < 4; i++) {
      const layer = layers[i];
      // Propagate
      layer.on("_needsUpdate", () => {
        this.effect.cloudLayers[i].set(layer.impl);
        this.emit("_needsUpdate");
      });
    }

    this.effect.cloudLayers.set(layers.map((l) => l.impl));

    this._cloudLayers = layers;
  }

  get inner() {
    return this.effect;
  }

  protected onAdded() {
    if (!this.effect) return;

    // Processing
    this.qualityPreset = this.options.qualityPreset;
    this.localWeatherVelocity = this.options.localWeatherVelocity;
    this.resolutionScale = this.options.resolutionScale;

    // Haze
    this.haze = this.options.haze;
    this.hazeDensityScale = this.options.hazeDensityScale;
    this.hazeExponent = this.options.hazeExponent;
    this.hazeScatteringCoefficient = this.options.hazeScatteringCoefficient;
    this.hazeAbsorptionCoefficient = this.options.hazeAbsorptionCoefficient;

    // Weather and shape
    this.localWeatherRepeat = this.options.localWeatherRepeat;
    this.localWeatherOffset = this.options.localWeatherOffset;
    this.shapeRepeat = this.options.shapeRepeat;
    this.shapeOffset = this.options.shapeOffset;
    this.shapeDetailRepeat = this.options.shapeDetailRepeat;
    this.shapeDetailOffset = this.options.shapeDetailOffset;
    this.turbulenceRepeat = this.options.turbulenceRepeat;
    this.turbulenceDisplacement = this.options.turbulenceDisplacement;

    // Scattering
    this.scatteringCoefficient = this.options.scatteringCoefficient;
    this.absorptionCoefficient = this.options.absorptionCoefficient;
    this.scatterAnisotropy1 = this.options.scatterAnisotropy1;
    this.scatterAnisotropy2 = this.options.scatterAnisotropy2;
    this.scatterAnisotropyMix = this.options.scatterAnisotropyMix;
    this.skyIrradianceScale = this.options.skyIrradianceScale;
    this.groundIrradianceScale = this.options.groundIrradianceScale;
    this.powderScale = this.options.powderScale;
    this.powderExponent = this.options.powderExponent;

    if (this.options.maxIterationCount != null) {
      this.maxIterationCount = this.options.maxIterationCount;
    }
    if (this.options.maxStepSize != null) {
      this.maxStepSize = this.options.maxStepSize;
    }
    if (this.options.minStepSize != null) {
      this.minStepSize = this.options.minStepSize;
    }
    if (this.options.lightShafts != null) {
      this.lightShafts = this.options.lightShafts;
    }
    this.effect.coverage = this.options.coverage;

    this.effect.shadow.farScale = this.options.shadowFarScale;
    this.effect.shadow.mapSize = this.options.shadowMapSize;
    this.effect.shadow.cascadeCount = this.options.shadowCascadeCount;

    this.forEachLayers((l) => {
      l.shadow = this.shadows;
    });

    this.loadAll().then(() => {
      this.emit("_needsUpdate");
    });
  }

  private forEachLayers(cb: (l: CloudLayerImpl) => void) {
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
    this.effect.stbnTexture = texture;
  };

  get qualityPreset() {
    return this.effect.qualityPreset;
  }
  set qualityPreset(v: CloudsQualityPreset) {
    this.effect.qualityPreset = v;

    this.emit("_needsUpdate");
  }

  get localWeatherVelocity() {
    return this.effect.localWeatherVelocity;
  }
  set localWeatherVelocity(v: Vector2) {
    this.effect.localWeatherVelocity.copy(v);

    this.emit("_needsUpdate");
  }

  get coverage() {
    return this.effect.coverage;
  }
  set coverage(v: number) {
    this.effect.coverage = v;

    this.emit("_needsUpdate");
  }

  get lightShafts() {
    return !!this.effect.lightShafts;
  }
  set lightShafts(v: boolean) {
    this.effect.lightShafts = v;

    this.emit("_needsUpdate");
  }

  // Processing

  get resolutionScale() {
    return this.effect.resolutionScale;
  }
  set resolutionScale(v: number) {
    this.effect.resolutionScale = v;
    this.emit("_needsUpdate");
  }

  get maxIterationCount() {
    return this.effect.clouds.maxIterationCount;
  }
  set maxIterationCount(v: number) {
    this.effect.clouds.maxIterationCount = v;
    this.emit("_needsUpdate");
  }

  get minStepSize() {
    return this.effect.clouds.minStepSize;
  }
  set minStepSize(v: number) {
    this.effect.clouds.minStepSize = v;
    this.emit("_needsUpdate");
  }

  get maxStepSize() {
    return this.effect.clouds.maxStepSize;
  }
  set maxStepSize(v: number) {
    this.effect.clouds.maxStepSize = v;
    this.emit("_needsUpdate");
  }

  // Shadow

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
    return this.effect.shadow.cascadeCount;
  }
  set shadowCascadeCount(v: number) {
    this.effect.shadow.cascadeCount = v;

    this.emit("_needsUpdate");
  }

  get shadowMapSize() {
    return this.effect.shadow.mapSize;
  }
  set shadowMapSize(v: Vector2) {
    this.effect.shadow.mapSize = v;

    this.emit("_needsUpdate");
  }

  get shadowFarScale() {
    return this.effect.shadow.farScale;
  }
  set shadowFarScale(v: number) {
    this.effect.shadow.farScale = v;

    this.emit("_needsUpdate");
  }

  // Haze

  get haze() {
    return this.effect.haze;
  }
  set haze(v: boolean) {
    this.effect.haze = v;

    this.emit("_needsUpdate");
  }

  get hazeDensityScale() {
    return this.effect.clouds.hazeDensityScale;
  }
  set hazeDensityScale(v: number) {
    this.effect.clouds.hazeDensityScale = v;

    this.emit("_needsUpdate");
  }

  get hazeExponent() {
    return this.effect.clouds.hazeExponent;
  }
  set hazeExponent(v: number) {
    this.effect.clouds.hazeExponent = v;

    this.emit("_needsUpdate");
  }

  get hazeScatteringCoefficient() {
    return this.effect.clouds.hazeScatteringCoefficient;
  }
  set hazeScatteringCoefficient(v: number) {
    this.effect.clouds.hazeScatteringCoefficient = v;

    this.emit("_needsUpdate");
  }

  get hazeAbsorptionCoefficient() {
    return this.effect.clouds.hazeAbsorptionCoefficient;
  }
  set hazeAbsorptionCoefficient(v: number) {
    this.effect.clouds.hazeAbsorptionCoefficient = v;

    this.emit("_needsUpdate");
  }

  // Weather and shape

  get localWeatherRepeat() {
    return this.effect.localWeatherRepeat;
  }
  set localWeatherRepeat(v: Vector2) {
    this.effect.localWeatherRepeat.copy(v);
    this.emit("_needsUpdate");
  }

  get localWeatherOffset() {
    return this.effect.localWeatherOffset;
  }
  set localWeatherOffset(v: Vector2) {
    this.effect.localWeatherOffset.copy(v);
    this.emit("_needsUpdate");
  }

  get shapeRepeat() {
    return this.effect.shapeRepeat;
  }
  set shapeRepeat(v: Vector3) {
    this.effect.shapeRepeat.copy(v);
    this.emit("_needsUpdate");
  }

  get shapeOffset() {
    return this.effect.shapeOffset;
  }
  set shapeOffset(v: Vector3) {
    this.effect.shapeOffset.copy(v);
    this.emit("_needsUpdate");
  }

  get shapeDetailRepeat() {
    return this.effect.shapeDetailRepeat;
  }
  set shapeDetailRepeat(v: Vector3) {
    this.effect.shapeDetailRepeat.copy(v);
    this.emit("_needsUpdate");
  }

  get shapeDetailOffset() {
    return this.effect.shapeDetailOffset;
  }
  set shapeDetailOffset(v: Vector3) {
    this.effect.shapeDetailOffset.copy(v);
    this.emit("_needsUpdate");
  }

  get turbulenceRepeat() {
    return this.effect.turbulenceRepeat;
  }
  set turbulenceRepeat(v: Vector2) {
    this.effect.turbulenceRepeat.copy(v);
    this.emit("_needsUpdate");
  }

  get turbulenceDisplacement() {
    return this.effect.turbulenceDisplacement;
  }
  set turbulenceDisplacement(v: number) {
    this.effect.turbulenceDisplacement = v;
    this.emit("_needsUpdate");
  }

  // Scattering

  get scatteringCoefficient() {
    return this.effect.scatteringCoefficient;
  }
  set scatteringCoefficient(v: number) {
    this.effect.scatteringCoefficient = v;
    this.emit("_needsUpdate");
  }

  get absorptionCoefficient() {
    return this.effect.absorptionCoefficient;
  }
  set absorptionCoefficient(v: number) {
    this.effect.absorptionCoefficient = v;
    this.emit("_needsUpdate");
  }

  get scatterAnisotropy1() {
    return this.effect.scatterAnisotropy1;
  }
  set scatterAnisotropy1(v: number) {
    this.effect.scatterAnisotropy1 = v;
    this.emit("_needsUpdate");
  }

  get scatterAnisotropy2() {
    return this.effect.scatterAnisotropy2;
  }
  set scatterAnisotropy2(v: number) {
    this.effect.scatterAnisotropy2 = v;
    this.emit("_needsUpdate");
  }

  get scatterAnisotropyMix() {
    return this.effect.scatterAnisotropyMix;
  }
  set scatterAnisotropyMix(v: number) {
    this.effect.scatterAnisotropyMix = v;
    this.emit("_needsUpdate");
  }

  get skyIrradianceScale() {
    return this.effect.skyIrradianceScale;
  }
  set skyIrradianceScale(v: number) {
    this.effect.skyIrradianceScale = v;
    this.emit("_needsUpdate");
  }

  get groundIrradianceScale() {
    return this.effect.groundIrradianceScale;
  }
  set groundIrradianceScale(v: number) {
    this.effect.groundIrradianceScale = v;
    this.emit("_needsUpdate");
  }

  get powderScale() {
    return this.effect.powderScale;
  }
  set powderScale(v: number) {
    this.effect.powderScale = v;
    this.emit("_needsUpdate");
  }

  get powderExponent() {
    return this.effect.powderExponent;
  }
  set powderExponent(v: number) {
    this.effect.powderExponent = v;
    this.emit("_needsUpdate");
  }

  /**
   * See [CloudLayers](https://github.com/takram-design-engineering/three-geospatial/tree/main/packages/clouds#cloudlayers).
   */
  get cloudLayers() {
    return this._cloudLayers;
  }
}
