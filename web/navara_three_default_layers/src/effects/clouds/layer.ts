import { EventHandler } from "@navara/core";
import {
  CloudLayer as CloudLayerImpl,
  type CloudLayerLike,
  type TextureChannel,
} from "@takram/three-clouds";

export type { TextureChannel };

export type CloudEvents = {
  needsUpdate: () => void;
};

export type CloudOptions = Pick<
  CloudDesc,
  | "channel"
  | "altitude"
  | "height"
  | "densityScale"
  | "shapeAmount"
  | "shapeDetailAmount"
  | "weatherExponent"
  | "shapeAlteringBias"
  | "coverageFilterWidth"
  | "shadow"
  | "expTerm"
  | "exponent"
  | "linearTerm"
  | "constantTerm"
>;

/**
 * See [CloudLayer](https://github.com/takram-design-engineering/three-geospatial/tree/main/packages/clouds#cloudlayer).
 */
export class CloudDesc extends EventHandler<CloudEvents> {
  impl: CloudLayerImpl;

  constructor(defaultOptions?: CloudLayerLike, options?: CloudOptions) {
    super();
    this.impl = new CloudLayerImpl(defaultOptions);

    this.channel = options?.channel ?? this.channel;
    this.altitude = options?.altitude ?? this.altitude;
    this.height = options?.height ?? this.height;
    this.densityScale = options?.densityScale ?? this.densityScale;
    this.shapeAmount = options?.shapeAmount ?? this.shapeAmount;
    this.shapeDetailAmount =
      options?.shapeDetailAmount ?? this.shapeDetailAmount;
    this.weatherExponent = options?.weatherExponent ?? this.weatherExponent;
    this.shapeAlteringBias =
      options?.shapeAlteringBias ?? this.shapeAlteringBias;
    this.coverageFilterWidth =
      options?.coverageFilterWidth ?? this.coverageFilterWidth;
    this.shadow = options?.shadow ?? this.shadow;
    this.expTerm = options?.expTerm ?? this.expTerm;
    this.exponent = options?.exponent ?? this.exponent;
    this.linearTerm = options?.linearTerm ?? this.linearTerm;
    this.constantTerm = options?.constantTerm ?? this.constantTerm;
  }

  onUpdate() {
    this.emit("needsUpdate");
  }

  get channel() {
    return this.impl.channel;
  }
  set channel(v: TextureChannel) {
    this.impl.channel = v;
    this.onUpdate();
  }

  get altitude() {
    return this.impl.altitude;
  }
  set altitude(v: number) {
    this.impl.altitude = v;
    this.onUpdate();
  }

  get height() {
    return this.impl.height;
  }
  set height(v: number) {
    this.impl.height = v;
    this.onUpdate();
  }

  get densityScale() {
    return this.impl.densityScale;
  }
  set densityScale(v: number) {
    this.impl.densityScale = v;
    this.onUpdate();
  }

  get shapeAmount() {
    return this.impl.shapeAmount;
  }
  set shapeAmount(v: number) {
    this.impl.shapeAmount = v;
    this.onUpdate();
  }

  get shapeDetailAmount() {
    return this.impl.shapeDetailAmount;
  }
  set shapeDetailAmount(v: number) {
    this.impl.shapeDetailAmount = v;
    this.onUpdate();
  }

  get weatherExponent() {
    return this.impl.weatherExponent;
  }
  set weatherExponent(v: number) {
    this.impl.weatherExponent = v;
    this.onUpdate();
  }

  get shapeAlteringBias() {
    return this.impl.shapeAlteringBias;
  }
  set shapeAlteringBias(v: number) {
    this.impl.shapeAlteringBias = v;
    this.onUpdate();
  }

  get coverageFilterWidth() {
    return this.impl.coverageFilterWidth;
  }
  set coverageFilterWidth(v: number) {
    this.impl.coverageFilterWidth = v;
    this.onUpdate();
  }

  get shadow() {
    return this.impl.shadow;
  }
  set shadow(v: boolean) {
    this.impl.shadow = v;
    this.onUpdate();
  }

  // Density profile

  /**
   * `expTerm` of [DensityProfile](https://github.com/takram-design-engineering/three-geospatial/tree/main/packages/clouds#densityprofile).
   */
  get expTerm() {
    return this.impl.densityProfile.expTerm;
  }
  set expTerm(v: number) {
    this.impl.densityProfile.expTerm = v;
    this.onUpdate();
  }

  /**
   * `exponent` of [DensityProfile](https://github.com/takram-design-engineering/three-geospatial/tree/main/packages/clouds#densityprofile).
   */
  get exponent() {
    return this.impl.densityProfile.exponent;
  }
  set exponent(v: number) {
    this.impl.densityProfile.exponent = v;
    this.onUpdate();
  }

  /**
   * `linearTerm` of [DensityProfile](https://github.com/takram-design-engineering/three-geospatial/tree/main/packages/clouds#densityprofile).
   */
  get linearTerm() {
    return this.impl.densityProfile.linearTerm;
  }
  set linearTerm(v: number) {
    this.impl.densityProfile.linearTerm = v;
    this.onUpdate();
  }

  /**
   * `constantTerm` of [DensityProfile](https://github.com/takram-design-engineering/three-geospatial/tree/main/packages/clouds#densityprofile).
   */
  get constantTerm() {
    return this.impl.densityProfile.constantTerm;
  }
  set constantTerm(v: number) {
    this.impl.densityProfile.constantTerm = v;
    this.onUpdate();
  }
}
