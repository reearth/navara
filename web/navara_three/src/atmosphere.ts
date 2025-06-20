import { EventHandler } from "@navara/core";
import {
  AerialPerspectiveEffect,
  getECIToECEFRotationMatrix,
  getMoonDirectionECEF,
  getSunDirectionECEF,
  PrecomputedTexturesLoader,
  SkyLightProbe,
  SkyMaterial,
  SunDirectionalLight,
  type PrecomputedTextures,
} from "@takram/three-atmosphere";
import type { CloudsEffectChangeEvent } from "@takram/three-clouds";
import { EffectPass, type EffectComposer } from "postprocessing";
import {
  AmbientLight,
  Color,
  Mesh,
  PlaneGeometry,
  Vector3,
  Matrix4,
  type PerspectiveCamera,
  type WebGLRenderer,
  Texture,
} from "three";
import invariant from "tiny-invariant";

import { ATMOSPHERE_ASSETS_URL, STARS_ASSETS_URL } from "./constants";
import { Clouds, DEFAULT_CLOUDS_OPTIONS, type CloudsOptions } from "./effects";
import { DEFAULT_STARS_OPTIONS, Stars, type StarsOptions } from "./mesh";
import { SKY_RENDER_ORDER } from "./renderOrder";
import type { Scenes } from "./scene";

export type AtmosphereEvents = {
  _needsUpdate: () => void;
};

export type AtmosphereOptions = {
  aerialPerspective?: boolean;
  atmosphereAssetsUrl?: string;
  sky?: boolean;

  stars?: boolean;
  starsAssetsUrl?: string;
  starsPointSize?: StarsOptions["pointSize"];
  starsRadianceScale?: StarsOptions["radianceScale"];

  sun?: boolean;
  sunLight?: boolean;
  sunLightColor?: Color;
  sunLightIntensity?: number;

  moon?: boolean;
  moonScale?: number;
  moonIntensity?: number;

  ambientLight?: boolean;
  ambientLightColor?: Color;
  ambientLightIntensity?: number;

  clouds?: boolean;
  cloudsShadow?: boolean;
  cloudsOptions?: CloudsOptions;

  date?: Date;
  photometric?: boolean;
  inscatter?: boolean;
  transmittance?: boolean;

  index?: number | null | undefined;
  cloudsIndex?: number | null | undefined;
};

const DEFAULT_LIGHT_COLOR = new Color(0xffffff);

// https://github.com/takram-design-engineering/three-geospatial/blob/2536eb9ea9ff6690d304aa744a777c2f11b06178/packages/atmosphere/src/SkyMaterial.ts#L53
const BASE_MOON_ANGULAR_RADIUS = 0.0045;

export const DEFAULT_ATMOSPHERE_OPTIONS: Required<AtmosphereOptions> = {
  aerialPerspective: true,
  atmosphereAssetsUrl: ATMOSPHERE_ASSETS_URL,
  sky: true,

  stars: true,
  starsAssetsUrl: STARS_ASSETS_URL,
  starsPointSize: DEFAULT_STARS_OPTIONS.pointSize,
  starsRadianceScale: DEFAULT_STARS_OPTIONS.radianceScale,

  sun: true,
  sunLight: true,
  sunLightColor: DEFAULT_LIGHT_COLOR.clone(),
  sunLightIntensity: 1,

  moon: true,
  moonScale: 1,
  moonIntensity: 1,

  clouds: false,
  cloudsShadow: true,
  cloudsOptions: DEFAULT_CLOUDS_OPTIONS,

  ambientLight: false,
  ambientLightColor: DEFAULT_LIGHT_COLOR.clone(),
  ambientLightIntensity: 1,
  date: new Date(),
  photometric: true,
  inscatter: true,
  transmittance: true,

  index: null,
  cloudsIndex: null,
};

export class Atmosphere extends EventHandler<AtmosphereEvents> {
  cloudsEffect?: Clouds;

  private effectComposer: EffectComposer;
  private scenes: Scenes;
  private renderer: WebGLRenderer;
  private camera: PerspectiveCamera;

  private sunDirection = new Vector3();
  private moonDirection = new Vector3();
  private rotationMatrix = new Matrix4();

  private textures?: PrecomputedTextures;

  private effect?: AerialPerspectiveEffect;
  private pass?: EffectPass;

  private skyMesh?: Mesh<PlaneGeometry, SkyMaterial>;
  private skyLightProbe?: SkyLightProbe;
  private sunLightObj?: SunDirectionalLight;
  private ambientLightObj?: AmbientLight;
  private starsMesh?: Stars;

  private normalBuffer: Texture;

  private options: Required<AtmosphereOptions>;
  private needsUpdate = false;

  constructor(
    effectComposer: EffectComposer,
    scenes: Scenes,
    renderer: WebGLRenderer,
    camera: PerspectiveCamera,
    normalBuffer: Texture,
    options: AtmosphereOptions = {},
  ) {
    super();

    this.effectComposer = effectComposer;
    this.scenes = scenes;
    this.renderer = renderer;
    this.camera = camera;
    this.options = { ...DEFAULT_ATMOSPHERE_OPTIONS, ...options };
    this.normalBuffer = normalBuffer;

    if (this.options.aerialPerspective) {
      this.init();
    } else {
      this.addSunLight();
    }
    this.addAmbientLight();

    this.onUpdate();
  }

  onUpdate = () => {
    this.needsUpdate = true;
    this.emit("_needsUpdate");
  };

  async initTextures() {
    if (this.textures) return;
    this.textures = await new PrecomputedTexturesLoader()
      .setTypeFromRenderer(this.renderer)
      .loadAsync(this.options.atmosphereAssetsUrl);
  }

  private async init() {
    await this.initTextures();
    invariant(this.textures);

    this.addAerialPerspective();
    this.addClouds();
    this.addSky();
    this.addStars();
    this.addSkyLightProbe();
    this.addSunLight();

    if (this.sunLightObj) {
      this.sunLightObj.color.copy(DEFAULT_LIGHT_COLOR);
      this.sunLightObj.transmittanceTexture =
        this.textures.transmittanceTexture;
    }

    this.onUpdate();
  }

  private addAerialPerspective() {
    if (this.pass) {
      this.pass.enabled = true;
      return;
    }

    this.effect = new AerialPerspectiveEffect(this.camera, {
      irradianceScale: 2 / Math.PI,
      photometric: this.options.photometric,
      inscatter: this.options.inscatter,
      transmittance: this.options.transmittance,
      octEncodedNormal: true,
    });

    invariant(this.textures);
    Object.assign(this.effect, this.textures);

    this.pass = new EffectPass(this.camera, this.effect);

    this.effectComposer.addPass(this.pass, this.index);
  }

  private addClouds() {
    if (this.cloudsEffect || !this.clouds || !this.effect) return;

    this.cloudsEffect = new Clouds(this.effectComposer, this.camera, {
      ...this.options.cloudsOptions,
      enabled: this.clouds,
      index: this.cloudsIndex,
    });

    this.cloudsEffect.inner.events.addEventListener(
      "change",
      (event: CloudsEffectChangeEvent) => {
        if (!this.effect || !this.cloudsEffect) return;
        switch (event.property) {
          case "atmosphereOverlay":
            this.effect.overlay = this.cloudsEffect.inner.atmosphereOverlay;
            break;
          case "atmosphereShadow":
            if (!this.cloudsShadow) break;
            this.effect.shadow = this.cloudsEffect.inner.atmosphereShadow;
            break;
          case "atmosphereShadowLength":
            this.effect.shadowLength =
              this.cloudsEffect.inner.atmosphereShadowLength;
            if (this.skyMesh) {
              this.skyMesh.material.shadowLength =
                this.cloudsEffect.inner.atmosphereShadowLength;
            }
            break;
        }
        this.onUpdate();
      },
    );

    this.cloudsEffect.on("_needsUpdate", this.onUpdate);

    if (this.effect) {
      this.effect.sunIrradiance = true;
      this.effect.skyIrradiance = true;
      this.effect.normalBuffer = this.normalBuffer;
    }

    invariant(this.textures);
    Object.assign(this.cloudsEffect.inner, this.textures);
  }

  private removeClouds() {
    if (!this.cloudsEffect) return;
    if (this.effect) {
      this.effect.overlay = null;
      this.effect.shadow = null;
      this.effect.shadowLength = null;
    }
    if (this.skyMesh) {
      this.skyMesh.material.shadowLength = null;
    }

    this.cloudsEffect.dispose();
    this.cloudsEffect = undefined;
  }

  // Remove resources related to the aerial perspective.
  private disableAerialPerspectiveRelated() {
    if (this.pass) {
      this.pass.enabled = false;
    }
    if (this.skyLightProbe) {
      this.skyLightProbe.visible = false;
    }
    if (this.sunLightObj) {
      // SunDirectionalLight calculates the sun color from the transmittance texture automatically whenever `transmittanceTexture` is there.
      // `transmittanceTexture` is no longer necessary when the aerial perspective is disabled. And it allows to specify the sun color.
      // https://github.com/takram-design-engineering/three-geospatial/blob/2b5e0ac70d961015b11b6d892c0eccecea48b7f6/packages/atmosphere/src/SunDirectionalLight.ts#L67-L69
      this.sunLightObj.transmittanceTexture = null;
      this.sunLightObj.color.copy(this.options.sunLightColor);
    }

    this.onUpdate();
  }

  // Dispose all objects related to atmosphere.
  dispose() {
    this.removeAerialPerspective();
    this.removeClouds();
    this.removeSky();
    this.removeStars();
    this.removeSkyLightProbe();
    this.removeSunLight();
    this.removeAmbientLight();
  }

  private removeAerialPerspective() {
    if (!this.pass) return;
    this.effectComposer.removePass(this.pass);
    this.pass = undefined;
    this.effect = undefined;
  }

  private async addSky() {
    if (this.skyMesh || !this.options.sky) return;

    const skyMaterial = new SkyMaterial({
      sun: this.options.sun,
      moon: this.options.moon,
    });
    this.skyMesh = new Mesh(new PlaneGeometry(2, 2), skyMaterial);
    this.skyMesh.frustumCulled = false;
    this.skyMesh.renderOrder = SKY_RENDER_ORDER;

    this.moonScale = this.options.moonScale;
    this.moonIntensity = this.options.moonIntensity;

    await this.initTextures();
    invariant(this.textures);

    Object.assign(skyMaterial, this.textures);

    this.scenes.post.add(this.skyMesh);
  }

  private removeSky() {
    if (!this.skyMesh) return;
    this.scenes.post.remove(this.skyMesh);
    this.skyMesh = undefined;
  }

  private async addStars() {
    if (this.starsMesh || !this.options.stars) return;

    const starsMesh = await Stars.fromUrl(this.options.starsAssetsUrl);
    if (!starsMesh) return;

    this.starsMesh = starsMesh;

    await this.initTextures();
    invariant(this.textures);

    Object.assign(this.starsMesh.material, this.textures);

    this.starsMesh.addEventListener("_needsUpdate", this.onUpdate);

    this.scenes.post.add(this.starsMesh);
  }

  private removeStars() {
    if (!this.starsMesh) return;
    this.starsMesh.removeEventListener("_needsUpdate", this.onUpdate);
    this.scenes.post.remove(this.starsMesh);
    this.starsMesh = undefined;
  }

  private async addSkyLightProbe() {
    if (!this.skyLightProbe) {
      this.skyLightProbe = new SkyLightProbe();
      this.scenes.world.add(this.skyLightProbe);
    }

    this.skyLightProbe.visible = true;

    await this.initTextures();
    invariant(this.textures);
    this.skyLightProbe.irradianceTexture = this.textures.irradianceTexture;
  }

  private removeSkyLightProbe() {
    if (!this.skyLightProbe) return;
    this.scenes.world.remove(this.skyLightProbe);
    this.skyLightProbe = undefined;
  }

  private async addSunLight() {
    if (!this.options.sunLight) return;

    if (!this.sunLightObj) {
      this.sunLightObj = new SunDirectionalLight({ distance: 300 });
    }

    this.sunLightObj.visible = true;
    this.sunLightObj.intensity = this.options.sunLightIntensity;

    if (this.aerialPerspective) {
      await this.initTextures();
      invariant(this.textures);

      this.sunLightObj.transmittanceTexture =
        this.textures.transmittanceTexture;
    } else {
      this.sunLightObj.color.copy(this.options.sunLightColor);
    }

    this.sunLightObj.castShadow = true;
    this.sunLightObj.shadow.camera.top = 300;
    this.sunLightObj.shadow.camera.bottom = -300;
    this.sunLightObj.shadow.camera.left = -300;
    this.sunLightObj.shadow.camera.right = 300;
    this.sunLightObj.shadow.camera.near = 0;
    this.sunLightObj.shadow.camera.far = 600;
    this.sunLightObj.shadow.mapSize.width = 2048;
    this.sunLightObj.shadow.mapSize.height = 2048;
    this.sunLightObj.shadow.normalBias = 1;

    this.scenes.world.add(this.sunLightObj);
    this.scenes.world.add(this.sunLightObj.target);
  }

  private removeSunLight() {
    if (!this.sunLightObj) return;
    this.scenes.world.remove(this.sunLightObj);
    this.scenes.world.remove(this.sunLightObj.target);
    this.sunLightObj = undefined;
  }

  private addAmbientLight() {
    if (this.ambientLightObj || !this.options.ambientLight) return;

    this.ambientLightObj = new AmbientLight(
      this.options.ambientLightColor,
      this.options.ambientLightIntensity,
    );

    this.scenes.world.add(this.ambientLightObj);
  }

  private removeAmbientLight() {
    if (!this.ambientLightObj) return;
    this.scenes.world.remove(this.ambientLightObj);
    this.ambientLightObj = undefined;
  }

  _update() {
    // Camera related
    const position = this.camera.position;
    if (this.sunLight) {
      this.sunLightObj?.target.position.copy(position);
    }
    if (this.aerialPerspective) {
      this.skyLightProbe?.position.copy(position);
    }

    if (this.needsUpdate) {
      getSunDirectionECEF(this.options.date, this.sunDirection);
      getMoonDirectionECEF(this.options.date, this.moonDirection);
      getECIToECEFRotationMatrix(this.options.date, this.rotationMatrix);

      // Sun light
      if (this.sunLight) {
        this.sunLightObj?.sunDirection.copy(this.sunDirection);
      }

      if (this.aerialPerspective) {
        // Sun
        this.effect?.sunDirection.copy(this.sunDirection);
        this.skyLightProbe?.sunDirection.copy(this.sunDirection);

        // Moon
        this.effect?.moonDirection.copy(this.moonDirection);
      }

      // Sky
      if (this.sky) {
        if (this.sun) {
          this.skyMesh?.material.sunDirection.copy(this.sunDirection);
        }
        if (this.moon) {
          this.skyMesh?.material.moonDirection.copy(this.moonDirection);
        }
      }

      // Stars
      if (this.stars) {
        this.starsMesh?.material.sunDirection.copy(this.sunDirection);
        this.starsMesh?.setRotationFromMatrix(this.rotationMatrix);
      }

      if (this.clouds) {
        this.cloudsEffect?.inner.sunDirection.copy(this.sunDirection);
      }
    }

    this.needsUpdate = false;

    if (this.aerialPerspective) {
      this.skyLightProbe?.update();
    }

    if (this.sunLight) {
      this.sunLightObj?.update();
    }
  }

  // Aerial perspective

  get aerialPerspective() {
    return this.options.aerialPerspective;
  }
  set aerialPerspective(v: boolean) {
    if (this.options.aerialPerspective === v) {
      return;
    }

    this.options.aerialPerspective = v;

    if (v) {
      this.init().then(this.onUpdate);
    } else {
      this.disableAerialPerspectiveRelated();
      this.onUpdate();
    }
  }

  // Sky

  get sky() {
    return this.options.sky;
  }
  set sky(v: boolean) {
    if (this.options.sky === v) return;
    this.options.sky = v;

    if (v) {
      this.addSky().then(this.onUpdate);
    } else {
      this.removeSky();
      this.onUpdate();
    }
  }

  // Stars

  get stars() {
    return this.options.stars;
  }
  set stars(v: boolean) {
    if (this.options.stars === v) return;
    this.options.stars = v;

    if (v) {
      this.addStars().then(this.onUpdate);
    } else {
      this.removeStars();
      this.onUpdate();
    }
  }

  get starsPointSize() {
    return this.options.starsPointSize;
  }
  set starsPointSize(v: number) {
    if (this.options.starsPointSize === v) return;
    this.options.starsPointSize = v;

    if (!this.starsMesh) return;
    this.starsMesh.pointSize = v;

    this.onUpdate();
  }

  get starsRadianceScale() {
    return this.options.starsRadianceScale;
  }
  set starsRadianceScale(v: number) {
    if (this.options.starsRadianceScale === v) return;
    this.options.starsRadianceScale = v;

    if (!this.starsMesh) return;
    this.starsMesh.radianceScale = v;

    this.onUpdate();
  }

  // Sun

  get sun() {
    return this.options.sun;
  }
  set sun(v: boolean) {
    if (this.options.sun === v) return;
    this.options.sun = v;

    if (this.skyMesh) {
      this.skyMesh.material.sun = v;
    }

    this.onUpdate();
  }

  get sunLight() {
    return this.options.sunLight;
  }
  set sunLight(v: boolean) {
    if (this.options.sunLight === v) return;
    this.options.sunLight = v;

    if (v) {
      this.addSunLight().then(this.onUpdate);
    } else {
      this.removeSunLight();
      this.onUpdate();
    }
  }

  get sunLightColor() {
    return this.options.sunLightColor;
  }
  set sunLightColor(v: Color) {
    if (this.options.sunLightColor === v) return;
    this.options.sunLightColor = v;

    if (!this.sunLightObj) return;
    this.sunLightObj.color.copy(this.options.sunLightColor);

    this.onUpdate();
  }

  get sunLightIntensity() {
    return this.options.sunLightIntensity;
  }
  set sunLightIntensity(v: number) {
    if (this.options.sunLightIntensity === v) return;
    this.options.sunLightIntensity = v;

    if (!this.sunLightObj) return;
    this.sunLightObj.intensity = this.options.sunLightIntensity;

    this.onUpdate();
  }

  // Ambient light

  get ambientLight() {
    return this.options.ambientLight;
  }
  set ambientLight(v: boolean) {
    if (this.options.ambientLight === v) return;
    this.options.ambientLight = v;

    if (v) {
      this.addAmbientLight();
    } else {
      this.removeAmbientLight();
    }

    this.onUpdate();
  }

  get ambientLightColor() {
    return this.options.ambientLightColor;
  }
  set ambientLightColor(v: Color) {
    if (this.options.ambientLightColor === v) return;
    this.options.ambientLightColor = v;

    this.ambientLightObj?.color.copy(this.options.ambientLightColor);

    this.onUpdate();
  }

  get ambientLightIntensity() {
    return this.options.ambientLightIntensity;
  }
  set ambientLightIntensity(v: number) {
    if (this.options.ambientLightIntensity === v) return;
    this.options.ambientLightIntensity = v;

    if (!this.ambientLightObj) return;
    this.ambientLightObj.intensity = this.options.ambientLightIntensity;

    this.onUpdate();
  }

  // Moon

  get moon() {
    return this.options.moon;
  }
  set moon(v: boolean) {
    if (this.options.moon === v) return;
    this.options.moon = v;

    if (this.skyMesh) {
      this.skyMesh.material.moon = v;
    }

    this.onUpdate();
  }

  get moonScale() {
    return this.options.moonScale;
  }
  set moonScale(v: number) {
    if (this.options.moonScale === v) return;
    this.options.moonScale = v;

    if (!this.skyMesh) return;
    this.skyMesh.material.moonAngularRadius =
      BASE_MOON_ANGULAR_RADIUS * this.options.moonScale;

    if (this.effect) {
      this.effect.moonAngularRadius = this.skyMesh.material.lunarRadianceScale;
    }

    this.onUpdate();
  }

  get moonIntensity() {
    return this.options.moonIntensity;
  }
  set moonIntensity(v: number) {
    if (this.options.moonIntensity === v) return;
    this.options.moonIntensity = v;

    if (!this.skyMesh) return;
    this.skyMesh.material.lunarRadianceScale = this.options.moonIntensity;

    if (this.effect) {
      this.effect.lunarRadianceScale = this.skyMesh.material.lunarRadianceScale;
    }

    this.onUpdate();
  }

  // Clouds

  get clouds() {
    return this.options.clouds;
  }

  set clouds(v: boolean) {
    if (this.options.clouds === v) {
      return;
    }

    this.options.clouds = v;

    if (v) {
      this.addClouds();
    } else {
      // This doesn't work well, so you should change `coverage` to 0 to hide clouds.
      this.removeClouds();
    }

    this.onUpdate();
  }

  // Others

  get date() {
    return this.options.date;
  }
  set date(v: Date) {
    this.options.date = v;
    this.onUpdate();
  }

  get photometric() {
    return this.options.photometric;
  }
  set photometric(v: boolean) {
    if (!this.effect) return;
    this.options.photometric = v;
    this.effect.photometric = v;
    this.onUpdate();
  }

  get inscatter() {
    return this.options.inscatter;
  }
  set inscatter(v: boolean) {
    if (!this.effect) return;
    this.options.inscatter = v;
    this.effect.inscatter = v;
    this.onUpdate();
  }

  get transmittance() {
    return this.options.transmittance;
  }
  set transmittance(v: boolean) {
    if (!this.effect) return;
    this.options.transmittance = v;
    this.effect.transmittance = v;
    this.onUpdate();
  }

  get index() {
    return this.options.index ?? undefined;
  }
  get cloudsIndex() {
    return this.options.cloudsIndex ?? undefined;
  }

  get cloudsShadow() {
    return this.options.cloudsShadow;
  }

  set cloudsShadow(v: boolean) {
    if (!this.effect || !this.cloudsEffect) return;
    if (v) {
      this.effect.shadow = this.cloudsEffect.inner.atmosphereShadow;
    } else {
      this.effect.shadow = null;
    }
  }
}
