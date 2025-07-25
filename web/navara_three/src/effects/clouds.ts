import type { Nullable } from "@navara/core";
import {
  CLOUD_SHAPE_DETAIL_TEXTURE_SIZE,
  CLOUD_SHAPE_TEXTURE_SIZE,
  CloudLayers,
  CloudsEffect,
  type CloudsEffectChangeEvent,
  type CloudsQualityPreset,
} from "@takram/three-clouds";
import {
  DataTextureLoader,
  parseUint8Array,
  STBNLoader,
} from "@takram/three-geospatial";
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
import invariant from "tiny-invariant";

import type { Atmosphere } from "../atmosphere";
import { CloudLayer, type CloudLayerOptions } from "../clouds";
import { CLOUD_ASSETS_URL, STBN_URL } from "../constants";

import { Effect, type EffectOptions } from "./effect";

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
  // Need to enable `Atmosphere.irradiance` as well.
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
  skyLightScale?: number;
  groundBounceScale?: number;
  powderScale?: number;
  powderExponent?: number;

  cloudLayers?: Nullable<CloudLayerOptions[]>;
} & EffectOptions;

// Default value is based on the medium preset.
export const DEFAULT_CLOUDS_OPTIONS: Required<CloudsOptions> = {
  enabled: false,
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
  skyLightScale: 1,
  groundBounceScale: 1,
  powderScale: 0.8,
  powderExponent: 150,

  cloudLayers: null,
};

export class Clouds extends Effect<CloudsEffect, Required<CloudsOptions>> {
  atmosphere: Atmosphere;
  private _cloudLayers: CloudLayer[] = [];

  constructor(camera: Camera, atmosphere: Atmosphere, options?: CloudsOptions) {
    super(camera, new CloudsEffect(camera), {
      ...DEFAULT_CLOUDS_OPTIONS,
      ...(options ?? {}),
    });

    this.atmosphere = atmosphere;

    this.atmosphere._enableShadows.value = this.shadows;

    this.init();
  }

  init() {
    if (!this.rawEffect) return;

    this.initializeCloudLayers(this.options?.cloudLayers ?? undefined);

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
    this.skyLightScale = this.options.skyLightScale;
    this.groundBounceScale = this.options.groundBounceScale;
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
    this.coverage = this.options.coverage;

    this.shadowFarScale = this.options.shadowFarScale;
    this.shadowMapSize = this.options.shadowMapSize;
    this.shadowCascadeCount = this.options.shadowCascadeCount;

    this.loadAll().then(() => {
      this.emit("_needsUpdate");
    });

    this.inner.events.addEventListener(
      "change",
      (event: CloudsEffectChangeEvent) => {
        if (!this.rawEffect || !this.atmosphere) return;
        switch (event.property) {
          case "atmosphereOverlay":
            this.atmosphere._overlay.value = this.rawEffect.atmosphereOverlay;
            break;
          case "atmosphereShadow":
            if (!this.shadows) break;
            this.atmosphere._shadow.value = this.inner.atmosphereShadow;
            // Denoise shadow artifact.
            new STBNLoader().load(this.options.stbnUrl, (data) => {
              if (!this.rawEffect) return;
              this.rawEffect.stbnTexture = data;
            });
            break;
          case "atmosphereShadowLength":
            this.atmosphere._shadowLength.value =
              this.inner.atmosphereShadowLength;
            break;
        }
        this.atmosphere.onUpdate();
      },
    );

    if (this.atmosphere.textures) {
      this.onTextureLoaded();
    } else {
      this.atmosphere.on("_textureLoaded", this.onTextureLoaded);
    }

    this.atmosphere.on("_disposed", this.onDisposed);
  }

  private onTextureLoaded = () => {
    invariant(this.atmosphere.textures);
    Object.assign(this.rawEffect, this.atmosphere.textures);
    this.atmosphere.off("_textureLoaded", this.onTextureLoaded);
  };

  private onDisposed = () => {
    this.dispose();
    this.atmosphere?.off("_disposed", this.onDisposed);
  };

  _update() {
    this.inner.sunDirection.copy(this.atmosphere.sunDirection);
  }

  dispose() {
    this.atmosphere._overlay.value = null;
    this.atmosphere._shadow.value = null;
    this.atmosphere._shadowLength.value = null;
    super.dispose();
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
        this.rawEffect.cloudLayers[i].set(layer.impl);
        this.emit("_needsUpdate");
      });
    }

    this.rawEffect.cloudLayers.set(layers.map((l) => l.impl));

    this._cloudLayers = layers;
  }

  get inner() {
    return this.rawEffect;
  }

  loadAll() {
    return Promise.all([
      new TextureLoader()
        .loadAsync(`${this.options.assetsUrl}/local_weather.png`)
        .then(this.onLocalWeatherLoad),
      new DataTextureLoader(Data3DTexture, parseUint8Array, {
        width: CLOUD_SHAPE_TEXTURE_SIZE,
        height: CLOUD_SHAPE_TEXTURE_SIZE,
        depth: CLOUD_SHAPE_TEXTURE_SIZE,
      })
        .loadAsync(`${this.options.assetsUrl}/shape.bin`)
        .then(this.onShapeLoad),
      new DataTextureLoader(Data3DTexture, parseUint8Array, {
        width: CLOUD_SHAPE_DETAIL_TEXTURE_SIZE,
        height: CLOUD_SHAPE_DETAIL_TEXTURE_SIZE,
        depth: CLOUD_SHAPE_DETAIL_TEXTURE_SIZE,
      })
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
    this.rawEffect.localWeatherTexture = texture;
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
    this.rawEffect.shapeTexture = texture;
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
    this.rawEffect.shapeDetailTexture = texture;
  };

  onTurbulenceLoad = (texture: Texture): void => {
    texture.minFilter = LinearMipMapLinearFilter;
    texture.magFilter = LinearFilter;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.colorSpace = NoColorSpace;
    texture.needsUpdate = true;
    this.rawEffect.turbulenceTexture = texture;
  };

  onSTBNLoad = (texture: Data3DTexture): void => {
    this.rawEffect.stbnTexture = texture;
  };

  get qualityPreset() {
    return this.rawEffect.qualityPreset;
  }
  set qualityPreset(v: CloudsQualityPreset) {
    this.rawEffect.qualityPreset = v;

    this.emit("_needsUpdate");
  }

  get localWeatherVelocity() {
    return this.rawEffect.localWeatherVelocity;
  }
  set localWeatherVelocity(v: Vector2) {
    this.rawEffect.localWeatherVelocity.copy(v);

    this.emit("_needsUpdate");
  }

  get coverage() {
    return this.rawEffect.coverage;
  }
  set coverage(v: number) {
    this.rawEffect.coverage = v;

    this.emit("_needsUpdate");
  }

  get lightShafts() {
    return !!this.rawEffect.lightShafts;
  }
  set lightShafts(v: boolean) {
    this.rawEffect.lightShafts = v;

    this.emit("_needsUpdate");
  }

  // Processing

  get resolutionScale() {
    return this.rawEffect.resolutionScale;
  }
  set resolutionScale(v: number) {
    this.rawEffect.resolutionScale = v;
    this.emit("_needsUpdate");
  }

  get maxIterationCount() {
    return this.rawEffect.clouds.maxIterationCount;
  }
  set maxIterationCount(v: number) {
    this.rawEffect.clouds.maxIterationCount = v;
    this.emit("_needsUpdate");
  }

  get minStepSize() {
    return this.rawEffect.clouds.minStepSize;
  }
  set minStepSize(v: number) {
    this.rawEffect.clouds.minStepSize = v;
    this.emit("_needsUpdate");
  }

  get maxStepSize() {
    return this.rawEffect.clouds.maxStepSize;
  }
  set maxStepSize(v: number) {
    this.rawEffect.clouds.maxStepSize = v;
    this.emit("_needsUpdate");
  }

  // Shadow

  get shadows() {
    return this.options.shadows;
  }
  set shadows(v: boolean) {
    this.options.shadows = v;
    this.atmosphere._enableShadows.value = v;

    this.emit("_needsUpdate");
  }

  get shadowCascadeCount() {
    return this.rawEffect.shadow.cascadeCount;
  }
  set shadowCascadeCount(v: number) {
    this.rawEffect.shadow.cascadeCount = v;

    this.emit("_needsUpdate");
  }

  get shadowMapSize() {
    return this.rawEffect.shadow.mapSize;
  }
  set shadowMapSize(v: Vector2) {
    this.rawEffect.shadow.mapSize = v;

    this.emit("_needsUpdate");
  }

  get shadowFarScale() {
    return this.rawEffect.shadow.farScale;
  }
  set shadowFarScale(v: number) {
    this.rawEffect.shadow.farScale = v;

    this.emit("_needsUpdate");
  }

  // Haze

  get haze() {
    return this.rawEffect.haze;
  }
  set haze(v: boolean) {
    this.rawEffect.haze = v;

    this.emit("_needsUpdate");
  }

  get hazeDensityScale() {
    return this.rawEffect.clouds.hazeDensityScale;
  }
  set hazeDensityScale(v: number) {
    this.rawEffect.clouds.hazeDensityScale = v;

    this.emit("_needsUpdate");
  }

  get hazeExponent() {
    return this.rawEffect.clouds.hazeExponent;
  }
  set hazeExponent(v: number) {
    this.rawEffect.clouds.hazeExponent = v;

    this.emit("_needsUpdate");
  }

  get hazeScatteringCoefficient() {
    return this.rawEffect.clouds.hazeScatteringCoefficient;
  }
  set hazeScatteringCoefficient(v: number) {
    this.rawEffect.clouds.hazeScatteringCoefficient = v;

    this.emit("_needsUpdate");
  }

  get hazeAbsorptionCoefficient() {
    return this.rawEffect.clouds.hazeAbsorptionCoefficient;
  }
  set hazeAbsorptionCoefficient(v: number) {
    this.rawEffect.clouds.hazeAbsorptionCoefficient = v;

    this.emit("_needsUpdate");
  }

  // Weather and shape

  get localWeatherRepeat() {
    return this.rawEffect.localWeatherRepeat;
  }
  set localWeatherRepeat(v: Vector2) {
    this.rawEffect.localWeatherRepeat.copy(v);
    this.emit("_needsUpdate");
  }

  get localWeatherOffset() {
    return this.rawEffect.localWeatherOffset;
  }
  set localWeatherOffset(v: Vector2) {
    this.rawEffect.localWeatherOffset.copy(v);
    this.emit("_needsUpdate");
  }

  get shapeRepeat() {
    return this.rawEffect.shapeRepeat;
  }
  set shapeRepeat(v: Vector3) {
    this.rawEffect.shapeRepeat.copy(v);
    this.emit("_needsUpdate");
  }

  get shapeOffset() {
    return this.rawEffect.shapeOffset;
  }
  set shapeOffset(v: Vector3) {
    this.rawEffect.shapeOffset.copy(v);
    this.emit("_needsUpdate");
  }

  get shapeDetailRepeat() {
    return this.rawEffect.shapeDetailRepeat;
  }
  set shapeDetailRepeat(v: Vector3) {
    this.rawEffect.shapeDetailRepeat.copy(v);
    this.emit("_needsUpdate");
  }

  get shapeDetailOffset() {
    return this.rawEffect.shapeDetailOffset;
  }
  set shapeDetailOffset(v: Vector3) {
    this.rawEffect.shapeDetailOffset.copy(v);
    this.emit("_needsUpdate");
  }

  get turbulenceRepeat() {
    return this.rawEffect.turbulenceRepeat;
  }
  set turbulenceRepeat(v: Vector2) {
    this.rawEffect.turbulenceRepeat.copy(v);
    this.emit("_needsUpdate");
  }

  get turbulenceDisplacement() {
    return this.rawEffect.turbulenceDisplacement;
  }
  set turbulenceDisplacement(v: number) {
    this.rawEffect.turbulenceDisplacement = v;
    this.emit("_needsUpdate");
  }

  // Scattering

  get scatteringCoefficient() {
    return this.rawEffect.scatteringCoefficient;
  }
  set scatteringCoefficient(v: number) {
    this.rawEffect.scatteringCoefficient = v;
    this.emit("_needsUpdate");
  }

  get absorptionCoefficient() {
    return this.rawEffect.absorptionCoefficient;
  }
  set absorptionCoefficient(v: number) {
    this.rawEffect.absorptionCoefficient = v;
    this.emit("_needsUpdate");
  }

  get scatterAnisotropy1() {
    return this.rawEffect.scatterAnisotropy1;
  }
  set scatterAnisotropy1(v: number) {
    this.rawEffect.scatterAnisotropy1 = v;
    this.emit("_needsUpdate");
  }

  get scatterAnisotropy2() {
    return this.rawEffect.scatterAnisotropy2;
  }
  set scatterAnisotropy2(v: number) {
    this.rawEffect.scatterAnisotropy2 = v;
    this.emit("_needsUpdate");
  }

  get scatterAnisotropyMix() {
    return this.rawEffect.scatterAnisotropyMix;
  }
  set scatterAnisotropyMix(v: number) {
    this.rawEffect.scatterAnisotropyMix = v;
    this.emit("_needsUpdate");
  }

  get skyLightScale() {
    return this.rawEffect.skyLightScale;
  }
  set skyLightScale(v: number) {
    this.rawEffect.skyLightScale = v;
    this.emit("_needsUpdate");
  }

  get groundBounceScale() {
    return this.rawEffect.groundBounceScale;
  }
  set groundBounceScale(v: number) {
    this.rawEffect.groundBounceScale = v;
    this.emit("_needsUpdate");
  }

  get powderScale() {
    return this.rawEffect.powderScale;
  }
  set powderScale(v: number) {
    this.rawEffect.powderScale = v;
    this.emit("_needsUpdate");
  }

  get powderExponent() {
    return this.rawEffect.powderExponent;
  }
  set powderExponent(v: number) {
    this.rawEffect.powderExponent = v;
    this.emit("_needsUpdate");
  }

  /**
   * See [CloudLayers](https://github.com/takram-design-engineering/three-geospatial/tree/main/packages/clouds#cloudlayers).
   */
  get cloudLayers() {
    return this._cloudLayers;
  }
}
