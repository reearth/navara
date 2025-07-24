import { EventHandler } from "@navara/core";
import { SunDirectionalLight } from "@takram/three-atmosphere";
import { Color, Texture, Vector3 } from "three";

export type SunLightEvents = {
  _needsUpdate: () => void;
};

export type SunLightOptions = {
  distance?: number;
  color?: Color;
  applyColor?: boolean;
  intensity?: number;
  castShadow?: boolean;
  shadowMapSize?: number;
  shadowCamera?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
    near?: number;
    far?: number;
  };
  shadowNormalBias?: number;
};

const DEFAULT_SUN_LIGHT_OPTIONS: Required<SunLightOptions> = {
  distance: 300,
  color: new Color(0xffffff),
  applyColor: false,
  intensity: 1,
  castShadow: true,
  shadowMapSize: 2048,
  shadowCamera: {
    top: 300,
    bottom: -300,
    left: -300,
    right: 300,
    near: 0,
    far: 600,
  },
  shadowNormalBias: 1,
};

export class SunLight extends EventHandler<SunLightEvents> {
  raw: SunDirectionalLight;
  private transmittanceTexture: Texture | null = null;
  private options: SunLightOptions;

  constructor(options: SunLightOptions = {}) {
    super();

    this.options = { ...DEFAULT_SUN_LIGHT_OPTIONS, ...options };

    this.raw = new SunDirectionalLight({
      distance: this.options.distance,
    });

    this.setupShadows();

    this.raw.intensity = this.intensity;
    this.raw.color.copy(this.color);
  }

  private setupShadows() {
    this.raw.castShadow = this.options.castShadow ?? this.raw.castShadow;
    this.raw.shadow.camera.top =
      this.options.shadowCamera?.top ?? this.raw.shadow.camera.top;
    this.raw.shadow.camera.bottom =
      this.options.shadowCamera?.bottom ?? this.raw.shadow.camera.bottom;
    this.raw.shadow.camera.left =
      this.options.shadowCamera?.left ?? this.raw.shadow.camera.left;
    this.raw.shadow.camera.right =
      this.options.shadowCamera?.right ?? this.raw.shadow.camera.right;
    this.raw.shadow.camera.near =
      this.options.shadowCamera?.near ?? this.raw.shadow.camera.near;
    this.raw.shadow.camera.far =
      this.options.shadowCamera?.far ?? this.raw.shadow.camera.far;
    this.raw.shadow.mapSize.width =
      this.options.shadowMapSize ?? this.raw.shadow.mapSize.width;
    this.raw.shadow.mapSize.height =
      this.options.shadowMapSize ?? this.raw.shadow.mapSize.height;
    this.raw.shadow.normalBias =
      this.options.shadowNormalBias ?? this.raw.shadow.normalBias;
  }

  updateSunDirection(sunDirection: Vector3) {
    this.raw.sunDirection.copy(sunDirection);
  }

  updateTargetPosition(position: Vector3) {
    if (this.applyColor) {
      return;
    }
    this.raw.target.position.copy(position);
  }

  get visible() {
    return this.raw.visible;
  }
  set visible(v: boolean) {
    this.raw.visible = v;
    this.emit("_needsUpdate");
  }

  get intensity() {
    return this.raw.intensity;
  }
  set intensity(v: number) {
    this.raw.intensity = v;
    this.emit("_needsUpdate");
  }

  get color() {
    return this.raw.color;
  }
  set color(v: Color) {
    this.options.color = v;
    this.raw.color.copy(v);
    this.emit("_needsUpdate");
  }

  get applyColor() {
    return this.options.applyColor ?? DEFAULT_SUN_LIGHT_OPTIONS.applyColor;
  }
  set applyColor(v: boolean) {
    this.options.applyColor = v;
    this.raw.transmittanceTexture = v ? null : this.transmittanceTexture;
    if (v) {
      this.color = this.options.color ?? DEFAULT_SUN_LIGHT_OPTIONS.color;
    }
    this.emit("_needsUpdate");
  }

  get target() {
    return this.raw.target;
  }

  update() {
    this.raw.update();
  }

  setTransmittanceTexture(texture: Texture) {
    this.transmittanceTexture = texture;
    this.raw.transmittanceTexture = texture;
  }

  clearTransmittanceTexture() {
    this.raw.transmittanceTexture = null;
  }
}
