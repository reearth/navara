import {
  AerialPerspectiveEffect,
  type AtmosphereOverlay,
  type AtmosphereShadow,
  type AtmosphereShadowLength,
} from "@takram/three-atmosphere";
import { type PerspectiveCamera, Texture } from "three";
import invariant from "tiny-invariant";

import type { Atmosphere } from "../atmosphere";
import { Pass, type EffectOptions } from "../effects";

import { CustomEffectPass } from "./CustomEffectPass";

export type AerialPerspectiveOptions = {
  inscatter?: boolean;
  transmittance?: boolean;
  // This is used to light a material in the post-processing stage.
  // Note that:
  // - It doesn't support transparency.
  // - Enable this flag when rendering clouds with shadows.
  irradiance?: boolean;
  sky?: boolean;
  sun?: boolean;
  moon?: boolean;
} & EffectOptions;

export const DEFAULT_AERIAL_PERSPECTIVE_OPTIONS: Required<AerialPerspectiveOptions> =
  {
    enabled: true,
    inscatter: true,
    transmittance: true,
    irradiance: false,
    sky: false,
    sun: true,
    moon: true,
  };

export class AerialPerspective extends Pass<
  CustomEffectPass,
  AerialPerspectiveEffect,
  AerialPerspectiveOptions
> {
  atmosphere: Atmosphere;

  private cloudsShadows = true;

  constructor(
    atmosphere: Atmosphere,
    camera: PerspectiveCamera,
    normalBuffer: Texture,
    _options: AerialPerspectiveOptions = {},
  ) {
    const effect = new AerialPerspectiveEffect(camera, {
      albedoScale: 2 / Math.PI,
      normalBuffer: normalBuffer,
      octEncodedNormal: true,
    });
    const pass = new CustomEffectPass(camera, effect);
    const options = { ...DEFAULT_AERIAL_PERSPECTIVE_OPTIONS, ..._options };
    super(pass, effect, options);

    this.atmosphere = atmosphere;

    this.options = options;

    this.init();

    this.onUpdate();
  }

  onUpdate = () => {
    this.emit("_needsUpdate");
  };

  init() {
    this.inscatter = !!this.options.inscatter;
    this.transmittance = !!this.options.transmittance;
    this.irradiance = !!this.options.irradiance;
    this.sky = !!this.options.sky;
    this.sun = !!this.options.sun;
    this.moon = !!this.options.moon;

    if (this.atmosphere.textures) {
      this.onTextureLoaded();
    } else {
      this.atmosphere.on("_textureLoaded", this.onTextureLoaded);
    }

    this.atmosphere._overlay.on("changed", this.onOverlayChanged);
    this.atmosphere._shadow.on("changed", this.onShadowChanged);
    this.atmosphere._shadowLength.on("changed", this.onShadowLengthChanged);
    this.atmosphere._enableShadows.on("changed", this.onEnableShadowChanged);
  }

  onTextureLoaded = () => {
    invariant(this.atmosphere.textures);
    Object.assign(this.rawEffect, this.atmosphere.textures);
    this.atmosphere.off("_textureLoaded", this.onTextureLoaded);
  };

  onOverlayChanged = (v: AtmosphereOverlay | null) => {
    this.rawEffect.overlay = v;
  };
  onShadowChanged = (v: AtmosphereShadow | null) => {
    if (this.cloudsShadows) {
      this.rawEffect.shadow = v;
    } else {
      this.rawEffect.shadow = null;
    }
  };
  onShadowLengthChanged = (v: AtmosphereShadowLength | null) => {
    this.rawEffect.shadowLength = v;
  };
  onEnableShadowChanged = (v: boolean) => {
    this.cloudsShadows = v;
    if (v) {
      this.rawEffect.shadow = this.atmosphere._shadow.value;
    } else {
      this.rawEffect.shadow = null;
    }
  };

  _update() {
    if (!this.enabled) return;

    // Sun
    this.rawEffect?.sunDirection.copy(this.atmosphere.sunDirection);

    // Moon
    this.rawEffect?.moonDirection.copy(this.atmosphere.moonDirection);
  }

  get inscatter() {
    return (
      this.options.inscatter ?? DEFAULT_AERIAL_PERSPECTIVE_OPTIONS.inscatter
    );
  }
  set inscatter(v: boolean) {
    if (!this.rawEffect) return;
    this.options.inscatter = v;
    this.rawEffect.inscatter = v;
    this.onUpdate();
  }

  get transmittance() {
    return (
      this.options.transmittance ??
      DEFAULT_AERIAL_PERSPECTIVE_OPTIONS.transmittance
    );
  }
  set transmittance(v: boolean) {
    if (!this.rawEffect) return;
    this.options.transmittance = v;
    this.rawEffect.transmittance = v;
    this.onUpdate();
  }

  get irradiance() {
    return (
      this.options.irradiance ?? DEFAULT_AERIAL_PERSPECTIVE_OPTIONS.irradiance
    );
  }
  set irradiance(v: boolean) {
    if (!this.rawEffect) return;
    this.options.irradiance = v;
    this.rawEffect.sunLight = v;
    this.rawEffect.skyLight = v;
    this.onUpdate();
  }

  get sky() {
    return this.options.sky ?? DEFAULT_AERIAL_PERSPECTIVE_OPTIONS.sky;
  }
  set sky(v: boolean) {
    if (!this.rawEffect) return;
    this.options.sky = v;
    this.rawEffect.sky = v;
    this.onUpdate();
  }

  get sun() {
    return this.options.sun ?? DEFAULT_AERIAL_PERSPECTIVE_OPTIONS.sun;
  }
  set sun(v: boolean) {
    if (!this.rawEffect) return;
    this.options.sun = v;
    this.rawEffect.sun = v;
    this.onUpdate();
  }

  get moon() {
    return this.options.moon ?? DEFAULT_AERIAL_PERSPECTIVE_OPTIONS.moon;
  }
  set moon(v: boolean) {
    if (!this.rawEffect) return;
    this.options.moon = v;
    this.rawEffect.moon = v;
    this.onUpdate();
  }
}
