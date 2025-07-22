import { EventHandler, Observed } from "@navara/core";
import {
  getECIToECEFRotationMatrix,
  getMoonDirectionECEF,
  getSunDirectionECEF,
  PrecomputedTexturesLoader,
  SkyLightProbe,
  SkyMaterial,
  SunDirectionalLight,
  type AtmosphereOverlay,
  type AtmosphereShadow,
  type AtmosphereShadowLength,
  type PrecomputedTextures,
} from "@takram/three-atmosphere";
import {
  AmbientLight,
  Color,
  Mesh,
  PlaneGeometry,
  Vector3,
  Matrix4,
  type PerspectiveCamera,
  type WebGLRenderer,
} from "three";
import invariant from "tiny-invariant";

import { ATMOSPHERE_ASSETS_URL, STARS_ASSETS_URL, STBN_URL } from "./constants";
import { DEFAULT_STARS_OPTIONS, Stars, type StarsOptions } from "./mesh";
import { SKY_RENDER_ORDER } from "./renderOrder";
import type { Scenes } from "./scene";

export type AtmosphereEvents = {
  _needsUpdate: () => void;
  _textureLoaded: () => void;
  _disposed: () => void;
};

export type AtmosphereOptions = {
  aerialPerspective?: boolean;
  atmosphereAssetsUrl?: string;
  stbnUrl?: string;
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

  date?: Date;
};

const DEFAULT_LIGHT_COLOR = new Color(0xffffff);

// https://github.com/takram-design-engineering/three-geospatial/blob/2536eb9ea9ff6690d304aa744a777c2f11b06178/packages/atmosphere/src/SkyMaterial.ts#L53
const BASE_MOON_ANGULAR_RADIUS = 0.0045;

export const DEFAULT_ATMOSPHERE_OPTIONS: Required<AtmosphereOptions> = {
  aerialPerspective: true,
  atmosphereAssetsUrl: ATMOSPHERE_ASSETS_URL,
  stbnUrl: STBN_URL,
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

  ambientLight: false,
  ambientLightColor: DEFAULT_LIGHT_COLOR.clone(),
  ambientLightIntensity: 1,
  date: new Date(),
};

/**
 * Context for atmosphere.
 * Some variables are shared with Clouds and AerialPerspective.
 */
export class Atmosphere extends EventHandler<AtmosphereEvents> {
  private scenes: Scenes;
  private renderer: WebGLRenderer;
  private camera: PerspectiveCamera;

  sunDirection = new Vector3();
  moonDirection = new Vector3();
  private rotationMatrix = new Matrix4();

  textures?: PrecomputedTextures;

  skyMesh?: Mesh<PlaneGeometry, SkyMaterial>;
  skyLightProbe?: SkyLightProbe;
  sunLightObj?: SunDirectionalLight;
  ambientLightObj?: AmbientLight;
  starsMesh?: Stars;

  // Variables that come from Clouds.
  /**
   * @private
   */
  _overlay = new Observed<AtmosphereOverlay | null>(null);
  /**
   * @private
   */
  _shadow = new Observed<AtmosphereShadow | null>(null);
  /**
   * @private
   */
  _shadowLength = new Observed<AtmosphereShadowLength | null>(null);
  /**
   * @private
   */
  _enableShadows = new Observed<boolean>(true);

  private needsUpdate = false;

  private options: AtmosphereOptions;

  constructor(
    scenes: Scenes,
    renderer: WebGLRenderer,
    camera: PerspectiveCamera,
    options: AtmosphereOptions = {},
  ) {
    super();

    this.scenes = scenes;
    this.renderer = renderer;
    this.camera = camera;
    this.options = { ...DEFAULT_ATMOSPHERE_OPTIONS, ...options };

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
      .setType(this.renderer)
      .loadAsync(
        this.options.atmosphereAssetsUrl ??
          DEFAULT_ATMOSPHERE_OPTIONS.atmosphereAssetsUrl,
      );

    this.emit("_textureLoaded");
  }

  private async init() {
    await this.initTextures();

    this.addSky();
    this.addStars();
    this.addSkyLightProbe();
    this.addSunLight();

    if (this.sunLightObj) {
      this.sunLightObj.color.copy(DEFAULT_LIGHT_COLOR);
      this.on("_textureLoaded", () => {
        if (!this.sunLightObj) return;
        invariant(this.textures);
        this.sunLightObj.transmittanceTexture =
          this.textures.transmittanceTexture;
      });
    }

    this.onUpdate();
  }

  // Remove resources related to the aerial perspective.
  private disableAerialPerspectiveRelated() {
    if (this.skyLightProbe) {
      this.skyLightProbe.visible = false;
    }
    if (this.sunLightObj) {
      // SunDirectionalLight calculates the sun color from the transmittance texture automatically whenever `transmittanceTexture` is there.
      // `transmittanceTexture` is no longer necessary when the aerial perspective is disabled. And it allows to specify the sun color.
      // https://github.com/takram-design-engineering/three-geospatial/blob/2b5e0ac70d961015b11b6d892c0eccecea48b7f6/packages/atmosphere/src/SunDirectionalLight.ts#L67-L69
      this.sunLightObj.transmittanceTexture = null;
      this.sunLightObj.color.copy(this.sunLightColor);
    }

    this.onUpdate();
  }

  // Dispose all objects related to atmosphere.
  dispose() {
    this.disableAerialPerspectiveRelated();
    this.removeSky();
    this.removeStars();
    this.removeSkyLightProbe();
    this.removeSunLight();
    this.removeAmbientLight();

    this.emit("_disposed");
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

    const handleShadowLengthChanged = (v: AtmosphereShadowLength | null) => {
      if (!this.skyMesh) return;
      this.skyMesh.material.shadowLength = v;
    };
    this.skyMesh.userData.handleShadowLengthChanged = handleShadowLengthChanged;
    this._shadowLength.on("changed", handleShadowLengthChanged);

    this.moonScale =
      this.options.moonScale ?? DEFAULT_ATMOSPHERE_OPTIONS.moonScale;
    this.moonIntensity =
      this.options.moonIntensity ?? DEFAULT_ATMOSPHERE_OPTIONS.moonIntensity;

    await this.initTextures();
    invariant(this.textures);

    Object.assign(skyMaterial, this.textures);

    this.scenes.opaque.add(this.skyMesh);
  }

  private removeSky() {
    if (!this.skyMesh) return;
    this.scenes.opaque.remove(this.skyMesh);
    if (this.skyMesh.userData.handleShadowLengthChanged) {
      this._shadowLength.off(
        "changed",
        this.skyMesh.userData.handleShadowLengthChanged,
      );
    }
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

    this.scenes.opaque.add(this.starsMesh);
  }

  private removeStars() {
    if (!this.starsMesh) return;
    this.starsMesh.removeEventListener("_needsUpdate", this.onUpdate);
    this.scenes.opaque.remove(this.starsMesh);
    this.starsMesh = undefined;
  }

  private async addSkyLightProbe() {
    if (!this.skyLightProbe) {
      this.skyLightProbe = new SkyLightProbe();
      this.scenes.light.add(this.skyLightProbe);
    }

    this.skyLightProbe.visible = true;

    await this.initTextures();
    invariant(this.textures);
    this.skyLightProbe.irradianceTexture = this.textures.irradianceTexture;
  }

  private removeSkyLightProbe() {
    if (!this.skyLightProbe) return;
    this.scenes.light.remove(this.skyLightProbe);
    this.skyLightProbe = undefined;
  }

  private async addSunLight() {
    if (!this.options.sunLight) return;

    if (!this.sunLightObj) {
      this.sunLightObj = new SunDirectionalLight({ distance: 300 });
    }

    this.sunLightObj.visible = true;
    this.sunLightObj.intensity =
      this.options.sunLightIntensity ??
      DEFAULT_ATMOSPHERE_OPTIONS.sunLightIntensity;

    if (this.aerialPerspective) {
      await this.initTextures();
      invariant(this.textures);

      this.sunLightObj.transmittanceTexture =
        this.textures.transmittanceTexture;
    } else {
      this.sunLightObj.color.copy(this.sunLightColor);
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

    this.scenes.light.add(this.sunLightObj);
    this.scenes.light.add(this.sunLightObj.target);
  }

  private removeSunLight() {
    if (!this.sunLightObj) return;
    this.scenes.light.remove(this.sunLightObj);
    this.scenes.light.remove(this.sunLightObj.target);
    this.sunLightObj = undefined;
  }

  private addAmbientLight() {
    if (this.ambientLightObj || !this.options.ambientLight) return;

    this.ambientLightObj = new AmbientLight(
      this.options.ambientLightColor,
      this.options.ambientLightIntensity,
    );

    this.scenes.light.add(this.ambientLightObj);
  }

  private removeAmbientLight() {
    if (!this.ambientLightObj) return;
    this.scenes.light.remove(this.ambientLightObj);
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
      getSunDirectionECEF(this.date, this.sunDirection);
      getMoonDirectionECEF(this.date, this.moonDirection);
      getECIToECEFRotationMatrix(this.date, this.rotationMatrix);

      // Sun light
      if (this.sunLight) {
        this.sunLightObj?.sunDirection.copy(this.sunDirection);
      }

      if (this.aerialPerspective) {
        this.skyLightProbe?.sunDirection.copy(this.sunDirection);
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
    }

    this.needsUpdate = false;

    if (this.aerialPerspective) {
      this.skyLightProbe?.update();
    }

    if (this.sunLight) {
      this.sunLightObj?.update();
    }
  }

  // Sky

  get aerialPerspective() {
    return !!this.options.aerialPerspective;
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

  get sky() {
    return !!this.options.sky;
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
    return !!this.options.stars;
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
    return (
      this.options.starsPointSize ?? DEFAULT_ATMOSPHERE_OPTIONS.starsPointSize
    );
  }
  set starsPointSize(v: number) {
    if (this.options.starsPointSize === v) return;
    this.options.starsPointSize = v;

    if (!this.starsMesh) return;
    this.starsMesh.pointSize = v;

    this.onUpdate();
  }

  get starsRadianceScale() {
    return (
      this.options.starsRadianceScale ??
      DEFAULT_ATMOSPHERE_OPTIONS.starsRadianceScale
    );
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
    return !!this.options.sun;
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
    return this.options.sunLight ?? DEFAULT_ATMOSPHERE_OPTIONS.sunLight;
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
    return (
      this.options.sunLightColor ?? DEFAULT_ATMOSPHERE_OPTIONS.sunLightColor
    );
  }
  set sunLightColor(v: Color) {
    if (this.options.sunLightColor === v) return;
    this.options.sunLightColor = v;

    if (!this.sunLightObj) return;
    this.sunLightObj.color.copy(this.options.sunLightColor);

    this.onUpdate();
  }

  get sunLightIntensity() {
    return (
      this.options.sunLightIntensity ??
      DEFAULT_ATMOSPHERE_OPTIONS.sunLightIntensity
    );
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
    return !!this.options.ambientLight;
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
    return (
      this.options.ambientLightColor ??
      DEFAULT_ATMOSPHERE_OPTIONS.ambientLightColor
    );
  }
  set ambientLightColor(v: Color) {
    if (this.options.ambientLightColor === v) return;
    this.options.ambientLightColor = v;

    this.ambientLightObj?.color.copy(this.options.ambientLightColor);

    this.onUpdate();
  }

  get ambientLightIntensity() {
    return (
      this.options.ambientLightIntensity ??
      DEFAULT_ATMOSPHERE_OPTIONS.ambientLightIntensity
    );
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
    return !!this.options.moon;
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
    return this.options.moonScale ?? DEFAULT_ATMOSPHERE_OPTIONS.moonScale;
  }
  set moonScale(v: number) {
    if (this.options.moonScale === v) return;
    this.options.moonScale = v;

    if (!this.skyMesh) return;
    this.skyMesh.material.moonAngularRadius =
      BASE_MOON_ANGULAR_RADIUS * this.options.moonScale;

    this.onUpdate();
  }

  get moonIntensity() {
    return (
      this.options.moonIntensity ?? DEFAULT_ATMOSPHERE_OPTIONS.moonIntensity
    );
  }
  set moonIntensity(v: number) {
    if (this.options.moonIntensity === v) return;
    this.options.moonIntensity = v;

    if (!this.skyMesh) return;
    this.skyMesh.material.lunarRadianceScale = this.options.moonIntensity;

    this.onUpdate();
  }

  // Others

  get date() {
    return this.options.date ?? DEFAULT_ATMOSPHERE_OPTIONS.date;
  }
  set date(v: Date) {
    this.options.date = v;
    this.onUpdate();
  }
}
