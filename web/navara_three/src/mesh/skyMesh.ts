import { EventHandler, Observed } from "@navara/core";
import {
  SkyMaterial,
  type AtmosphereShadowLength,
  type PrecomputedTextures,
} from "@takram/three-atmosphere";
import { Mesh, PlaneGeometry, Vector3 } from "three";

import { SKY_RENDER_ORDER } from "../renderOrder";

export type SkyMeshEvents = {
  _needsUpdate: () => void;
};

export type SkyMeshOptions = {
  sun?: boolean;
  moon?: boolean;
  moonScale?: number;
  moonIntensity?: number;
};

// https://github.com/takram-design-engineering/three-geospatial/blob/2536eb9ea9ff6690d304aa744a777c2f11b06178/packages/atmosphere/src/SkyMaterial.ts#L53
const BASE_MOON_ANGULAR_RADIUS = 0.0045;

export class SkyMesh extends EventHandler<SkyMeshEvents> {
  raw: Mesh<PlaneGeometry, SkyMaterial>;
  private options: SkyMeshOptions;
  private handleShadowLengthChanged?: (
    v: AtmosphereShadowLength | null,
  ) => void;

  constructor(options: SkyMeshOptions = {}) {
    super();

    this.options = options;

    const skyMaterial = new SkyMaterial({
      sun: options.sun,
      moon: options.moon,
    });

    this.raw = new Mesh(new PlaneGeometry(2, 2), skyMaterial);
    this.raw.frustumCulled = false;
    this.raw.renderOrder = SKY_RENDER_ORDER;

    this.setupMoonProperties();
  }

  setTextures(textures: PrecomputedTextures) {
    Object.assign(this.raw.material, textures);
  }

  setShadowLengthHandler(
    shadowLengthObservable: Observed<AtmosphereShadowLength | null>,
  ) {
    this.handleShadowLengthChanged = (v: AtmosphereShadowLength | null) => {
      this.raw.material.shadowLength = v;
    };
    shadowLengthObservable.on("changed", this.handleShadowLengthChanged);
  }

  updateSunDirection(sunDirection: Vector3) {
    this.raw.material.sunDirection.copy(sunDirection);
  }

  updateMoonDirection(moonDirection: Vector3) {
    this.raw.material.moonDirection.copy(moonDirection);
  }

  private setupMoonProperties() {
    if (this.options.moonScale !== undefined) {
      this.moonScale = this.options.moonScale;
    }
    if (this.options.moonIntensity !== undefined) {
      this.moonIntensity = this.options.moonIntensity;
    }
  }

  get sun() {
    return this.raw.material.sun;
  }
  set sun(v: boolean) {
    this.raw.material.sun = v;
    this.emit("_needsUpdate");
  }

  get moon() {
    return this.raw.material.moon;
  }
  set moon(v: boolean) {
    this.raw.material.moon = v;
    this.emit("_needsUpdate");
  }

  get moonScale() {
    return this.options.moonScale ?? 1;
  }
  set moonScale(v: number) {
    this.options.moonScale = v;
    this.raw.material.moonAngularRadius = BASE_MOON_ANGULAR_RADIUS * v;
    this.emit("_needsUpdate");
  }

  get moonIntensity() {
    return this.options.moonIntensity ?? 1;
  }
  set moonIntensity(v: number) {
    this.options.moonIntensity = v;
    this.raw.material.lunarRadianceScale = v;
    this.emit("_needsUpdate");
  }

  dispose() {
    // Clean up will be handled externally
  }
}
