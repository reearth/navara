import { EventHandler } from "@navara/core";
import {
  AerialPerspectiveEffect,
  getMoonDirectionECEF,
  getSunDirectionECEF,
  PrecomputedTexturesLoader,
  SkyLightProbe,
  SkyMaterial,
  SunDirectionalLight,
  type PrecomputedTextures,
} from "@takram/three-atmosphere";
import { EffectPass, type EffectComposer } from "postprocessing";
import {
  AmbientLight,
  Color,
  Mesh,
  PlaneGeometry,
  Vector3,
  type PerspectiveCamera,
  type Scene,
  type WebGLRenderer,
} from "three";
import invariant from "tiny-invariant";

export type AtmosphereEvents = {
  _needsUpdate: () => void;
};

export type AtmosphereOptions = {
  aerialPerspective?: boolean;
  sky?: boolean;
  sun?: boolean;
  moon?: boolean;
  sunLight?: boolean;
  sunLightColor?: Color;
  sunLightIntensity?: number;
  ambientLight?: boolean;
  ambientLightColor?: Color;
  ambientLightIntensity?: number;
  date?: Date;
  photometric?: boolean;
  inscatter?: boolean;
  transmittance?: boolean;
};

const DEFAULT_LIGHT_COLOR = new Color(0xffffff);

export const DEFAULT_ATMOSPHERE_OPTIONS: Required<AtmosphereOptions> = {
  aerialPerspective: true,
  sky: true,
  sun: true,
  moon: true,
  sunLight: true,
  sunLightColor: DEFAULT_LIGHT_COLOR.clone(),
  sunLightIntensity: 1,
  ambientLight: false,
  ambientLightColor: DEFAULT_LIGHT_COLOR.clone(),
  ambientLightIntensity: 1,
  date: new Date(),
  photometric: true,
  inscatter: true,
  transmittance: true,
};

export class Atmosphere extends EventHandler<AtmosphereEvents> {
  private effectComposer: EffectComposer;
  private scene: Scene;
  private renderer: WebGLRenderer;
  private camera: PerspectiveCamera;

  private sunDirection = new Vector3();
  private moonDirection = new Vector3();

  private textures?: PrecomputedTextures;

  private effect?: AerialPerspectiveEffect;
  private pass?: EffectPass;

  private skyMesh?: Mesh<PlaneGeometry, SkyMaterial>;
  private skyLightProbe?: SkyLightProbe;
  private sunLightObj?: SunDirectionalLight;
  private ambientLightObj?: AmbientLight;

  private options: Required<AtmosphereOptions>;
  private needsUpdate = false;

  constructor(
    effectComposer: EffectComposer,
    scene: Scene,
    renderer: WebGLRenderer,
    camera: PerspectiveCamera,
    options: AtmosphereOptions = {},
  ) {
    super();

    this.effectComposer = effectComposer;
    this.scene = scene;
    this.renderer = renderer;
    this.camera = camera;
    this.options = { ...DEFAULT_ATMOSPHERE_OPTIONS, ...options };

    if (this.options.aerialPerspective) {
      this.init();
    }
  }

  private async init() {
    if (!this.textures) {
      this.textures = await new PrecomputedTexturesLoader()
        .setTypeFromRenderer(this.renderer)
        .loadAsync(new URL("../assets/atmosphere", import.meta.url).toString());
    }

    this.addAerialPerspective();
    this.addSky();
    this.addSkyLightProbe();
    this.addSunLight();

    if (this.sunLightObj) {
      this.sunLightObj.color.copy(DEFAULT_LIGHT_COLOR);
      this.sunLightObj.transmittanceTexture =
        this.textures.transmittanceTexture;
    }

    this.needsUpdate = true;
    this.emit("_needsUpdate");
  }

  private addAerialPerspective() {
    if (this.pass) return;

    this.effect = new AerialPerspectiveEffect(this.camera, {
      irradianceScale: 2 / Math.PI,
      photometric: this.options.photometric,
      inscatter: this.options.inscatter,
      transmittance: this.options.transmittance,
    });

    invariant(this.textures);
    Object.assign(this.effect, this.textures);

    this.pass = new EffectPass(this.camera, this.effect);

    this.effectComposer.addPass(this.pass);
  }

  // Remove resources related to the aerial perspective.
  private removeAerialPerspectiveRelated() {
    this.removeAerialPerspective();
    this.removeSky();
    this.removeSkyLightProbe();
    if (this.sunLightObj) {
      // SunDirectionalLight calculates the sun color from the transmittance texture automatically whenever `transmittanceTexture` is there.
      // `transmittanceTexture` is no longer necessary when the aerial perspective is disabled. And it allows to specify the sun color.
      // https://github.com/takram-design-engineering/three-geospatial/blob/2b5e0ac70d961015b11b6d892c0eccecea48b7f6/packages/atmosphere/src/SunDirectionalLight.ts#L67-L69
      this.sunLightObj.transmittanceTexture = null;
      this.sunLightObj.color.copy(this.options.sunLightColor);
    }

    this.needsUpdate = true;
    this.emit("_needsUpdate");
  }

  // Dispose all objects related to atmosphere.
  dispose() {
    this.removeAerialPerspective();
    this.removeSky();
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

  private addSky() {
    if (this.skyMesh || !this.options.sky) return;

    const skyMaterial = new SkyMaterial({
      sun: this.options.sun,
      moon: this.options.moon,
    });
    this.skyMesh = new Mesh(new PlaneGeometry(2, 2), skyMaterial);
    this.skyMesh.frustumCulled = false;

    invariant(this.textures);
    Object.assign(skyMaterial, this.textures);

    this.scene.add(this.skyMesh);
  }

  private removeSky() {
    if (!this.skyMesh) return;
    this.scene.remove(this.skyMesh);
    this.skyMesh = undefined;
  }

  private addSkyLightProbe() {
    if (this.skyLightProbe) return;

    this.skyLightProbe = new SkyLightProbe();

    invariant(this.textures);
    this.skyLightProbe.irradianceTexture = this.textures.irradianceTexture;

    this.scene.add(this.skyLightProbe);
  }

  private removeSkyLightProbe() {
    if (!this.skyLightProbe) return;
    this.scene.remove(this.skyLightProbe);
    this.skyLightProbe = undefined;
  }

  private addSunLight() {
    if (this.sunLightObj || !this.options.sunLight) return;

    this.sunLightObj = new SunDirectionalLight({ distance: 300 });
    this.sunLightObj.intensity = this.options.sunLightIntensity;

    if (this.aerialPerspective) {
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

    this.scene.add(this.sunLightObj);
    this.scene.add(this.sunLightObj.target);
  }

  private removeSunLight() {
    if (!this.sunLightObj) return;
    this.scene.remove(this.sunLightObj);
    this.sunLightObj = undefined;
  }

  private addAmbientLight() {
    if (this.ambientLightObj || !this.options.ambientLight) return;

    this.ambientLightObj = new AmbientLight(
      this.options.ambientLightColor,
      this.options.ambientLightIntensity,
    );

    this.scene.add(this.ambientLightObj);
  }

  private removeAmbientLight() {
    if (!this.ambientLightObj) return;
    this.scene.remove(this.ambientLightObj);
    this.ambientLightObj = undefined;
  }

  _update() {
    // Camera related
    const position = this.camera.position;
    if (this.options.sunLight) {
      this.sunLightObj?.target.position.copy(position);
    }

    if (this.needsUpdate) {
      getSunDirectionECEF(this.options.date, this.sunDirection);

      // Sun light
      if (this.options.sunLight) {
        this.sunLightObj?.sunDirection.copy(this.sunDirection);
      }
    }

    if (this.options.aerialPerspective) {
      this.skyLightProbe?.position.copy(position);

      if (this.needsUpdate) {
        // Sun
        this.effect?.sunDirection.copy(this.sunDirection);
        this.skyLightProbe?.sunDirection.copy(this.sunDirection);
        if (this.sky) {
          this.skyMesh?.material.sunDirection.copy(this.sunDirection);
        }

        // Moon
        getMoonDirectionECEF(this.options.date, this.moonDirection);
        this.effect?.moonDirection.copy(this.moonDirection);
        if (this.options.moon) {
          this.skyMesh?.material.moonDirection.copy(this.moonDirection);
        }
      }

      this.skyLightProbe?.update();
    }

    this.needsUpdate = false;

    if (this.options.sunLight) {
      this.sunLightObj?.update();
    }
  }

  get aerialPerspective() {
    return this.options.aerialPerspective;
  }
  set aerialPerspective(v: boolean) {
    if (this.options.aerialPerspective === v) {
      return;
    }

    this.options.aerialPerspective = v;

    if (v) {
      this.init();
    } else {
      this.removeAerialPerspectiveRelated();
    }

    this.needsUpdate = true;
    this.emit("_needsUpdate");
  }

  get sky() {
    return this.options.sky;
  }
  set sky(v: boolean) {
    if (this.options.sky === v) return;
    this.options.sky = v;

    if (v) {
      this.addSky();
    } else {
      this.removeSky();
    }

    this.needsUpdate = true;
    this.emit("_needsUpdate");
  }

  get sun() {
    return this.options.sun;
  }
  set sun(v: boolean) {
    if (this.options.sun === v) return;
    this.options.sun = v;

    if (this.skyMesh) {
      this.skyMesh.material.sun = v;
    }

    this.needsUpdate = true;
    this.emit("_needsUpdate");
  }

  get sunLight() {
    return this.options.sunLight;
  }
  set sunLight(v: boolean) {
    if (this.options.sunLight === v) return;
    this.options.sunLight = v;

    if (v) {
      this.addSunLight();
    } else {
      this.removeSunLight();
    }

    this.needsUpdate = true;
    this.emit("_needsUpdate");
  }

  get sunLightColor() {
    return this.options.sunLightColor;
  }
  set sunLightColor(v: Color) {
    if (this.options.sunLightColor === v) return;
    this.options.sunLightColor = v;

    if (!this.sunLightObj) return;
    this.sunLightObj.color.copy(this.options.sunLightColor);

    this.needsUpdate = true;
    this.emit("_needsUpdate");
  }

  get sunLightIntensity() {
    return this.options.sunLightIntensity;
  }
  set sunLightIntensity(v: number) {
    if (this.options.sunLightIntensity === v) return;
    this.options.sunLightIntensity = v;

    if (!this.sunLightObj) return;
    this.sunLightObj.intensity = this.options.sunLightIntensity;

    this.needsUpdate = true;
    this.emit("_needsUpdate");
  }

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

    this.needsUpdate = true;
    this.emit("_needsUpdate");
  }

  get ambientLightColor() {
    return this.options.ambientLightColor;
  }
  set ambientLightColor(v: Color) {
    if (this.options.ambientLightColor === v) return;
    this.options.ambientLightColor = v;

    this.ambientLightObj?.color.copy(this.options.ambientLightColor);

    this.needsUpdate = true;
    this.emit("_needsUpdate");
  }

  get ambientLightIntensity() {
    return this.options.ambientLightIntensity;
  }
  set ambientLightIntensity(v: number) {
    if (this.options.ambientLightIntensity === v) return;
    this.options.ambientLightIntensity = v;

    if (!this.ambientLightObj) return;
    this.ambientLightObj.intensity = this.options.ambientLightIntensity;

    this.needsUpdate = true;
    this.emit("_needsUpdate");
  }

  get moon() {
    return this.options.moon;
  }
  set moon(v: boolean) {
    if (this.options.moon === v) return;
    this.options.moon = v;

    if (this.skyMesh) {
      this.skyMesh.material.moon = v;
    }

    this.needsUpdate = true;
    this.emit("_needsUpdate");
  }

  get date() {
    return this.options.date;
  }
  set date(v: Date) {
    this.options.date = v;
    this.needsUpdate = true;
    this.emit("_needsUpdate");
  }

  get photometric() {
    return this.options.photometric;
  }
  set photometric(v: boolean) {
    if (!this.effect) return;
    this.options.photometric = v;
    this.effect.photometric = v;
    this.needsUpdate = true;
    this.emit("_needsUpdate");
  }

  get inscatter() {
    return this.options.inscatter;
  }
  set inscatter(v: boolean) {
    if (!this.effect) return;
    this.options.inscatter = v;
    this.effect.inscatter = v;
    this.needsUpdate = true;
    this.emit("_needsUpdate");
  }

  get transmittance() {
    return this.options.transmittance;
  }
  set transmittance(v: boolean) {
    if (!this.effect) return;
    this.options.transmittance = v;
    this.effect.transmittance = v;
    this.needsUpdate = true;
    this.emit("_needsUpdate");
  }
}
