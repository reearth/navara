// Based on the following work:
// https://github.com/StrandedKitty/three-csm/tree/master/src
// https://github.com/mrdoob/three.js/tree/r169/examples/jsm/csm

import {
  Box3,
  Color,
  Matrix4,
  Object3D,
  Vector2,
  Vector3,
  type Material,
  type OrthographicCamera,
  type PerspectiveCamera,
} from "three";
import invariant from "tiny-invariant";

import { CascadedDirectionalLights } from "./CascadedDirectionalLights";
import { FrustumCorners } from "./FrustumCorners";
import { MaterialStates } from "./MaterialStates";
import { splitFrustum, type FrustumSplitMode } from "./splitFrustum";

const vectorScratch1 = /*#__PURE__*/ new Vector3();
const vectorScratch2 = /*#__PURE__*/ new Vector3();
const matrixScratch1 = /*#__PURE__*/ new Matrix4();
const matrixScratch2 = /*#__PURE__*/ new Matrix4();
const frustumScratch = /*#__PURE__*/ new FrustumCorners();
const boxScratch = /*#__PURE__*/ new Box3();

export type CascadedShadowMapsOptions = {
  /**
   * Number of shadow cascades. More cascades provide better shadow quality
   * distribution but require more GPU resources.
   * @default 4
   */
  cascadeCount?: number;
  /**
   * Resolution of shadow maps (one per cascade). Higher values provide better
   * shadow quality but require more GPU memory.
   * @default 2048
   */
  mapSize?: number;
  /**
   * Frustum far plane distance. Shadows will not be visible farther than this
   * distance from the camera.
   * @default 5000
   */
  far?: number;
  /**
   * Defines the split scheme for the camera frustum:
   * - "uniform": Linear split distribution
   * - "logarithmic": Logarithmic split distribution (better for large scenes)
   * - "practical": Hybrid approach balancing quality and performance (recommended)
   * @default "practical"
   */
  mode?: FrustumSplitMode;
  /**
   * Lambda parameter for "practical" split mode. Controls the blend between
   * uniform (0.0) and logarithmic (1.0) split schemes.
   * @default 0.5
   */
  lambda?: number;
  /**
   * Defines how far the shadow camera is positioned behind the cascade frustum.
   * Larger values help prevent shadow clipping but may reduce precision.
   * @default 200
   */
  margin?: number;
  /**
   * Enables smooth transitions between shadow cascades to reduce visible seams.
   * @default true
   */
  fade?: boolean;
  /**
   * Disables cutting off the last cascade at the far plane, providing better
   * shadow coverage for distant objects.
   * @default false
   */
  disableLastCascadeCutoff?: boolean;
};

export const cascadedShadowMapsOptionsDefaults = {
  cascadeCount: 4,
  mapSize: 2048,
  far: 5000,
  mode: "practical",
  lambda: 0.5,
  margin: 200,
  fade: true,
  disableLastCascadeCutoff: false,
} satisfies Partial<CascadedShadowMapsOptions>;

export class CascadedShadowMaps {
  needsUpdateFrusta = true;

  readonly directionalLights = new CascadedDirectionalLights();
  readonly materialStates = new MaterialStates();
  readonly mainFrustum = new FrustumCorners();
  readonly cascadedFrusta: FrustumCorners[] = [];
  readonly splits: number[] = [];
  readonly cascades: Vector2[] = [];

  private _far: number;
  private _mode: FrustumSplitMode;
  private _lambda: number;
  private _margin: number;
  private _fade: boolean;
  private _disableLastCascadeCutoff: boolean;

  constructor(
    readonly mainCamera: PerspectiveCamera | OrthographicCamera,
    params?: CascadedShadowMapsOptions,
  ) {
    const {
      cascadeCount,
      mapSize,
      far,
      mode,
      lambda,
      margin,
      fade,
      disableLastCascadeCutoff,
    } = { ...cascadedShadowMapsOptionsDefaults, ...params };
    this._far = far;
    this._mode = mode;
    this._lambda = lambda;
    this._margin = margin;
    this._fade = fade;
    this._disableLastCascadeCutoff = disableLastCascadeCutoff;
    this.cascadeCount = cascadeCount;
    this.mapSize = mapSize;
  }

  dispose(): void {
    this.materialStates.dispose();
    this.directionalLights.dispose();
  }

  setupMaterial<T extends Material>(material: T): T {
    return this.materialStates.setup(material, this);
  }

  rollbackMaterial<T extends Material>(material: T): T {
    return this.materialStates.rollback(material);
  }

  setupMaterials<T extends readonly Material[]>(materials: T): () => void {
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < materials.length; ++i) {
      this.materialStates.setup(materials[i], this);
    }
    return () => {
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < materials.length; ++i) {
        this.materialStates.rollback(materials[i]);
      }
    };
  }

  private updateCascades(): void {
    const cascadeCount = this.cascadeCount;
    const splits = this.splits;
    splitFrustum(
      this.mode,
      cascadeCount,
      this.mainCamera.near,
      Math.min(this.mainCamera.far, this.far),
      this.lambda,
      splits,
    );
    this.mainFrustum.setFromCamera(this.mainCamera, this.far);
    this.mainFrustum.split(splits, this.cascadedFrusta);

    const cascades = this.cascades;
    for (let i = 0; i < cascadeCount; ++i) {
      const vector = cascades[i] ?? (cascades[i] = new Vector2());
      vector.set(splits[i - 1] ?? 0, splits[i] ?? 0);
    }
    if (this.disableLastCascadeCutoff) {
      cascades[cascadeCount - 1].y = Infinity;
    }
    cascades.length = cascadeCount;
  }

  private getFrustumRadius(frustum: FrustumCorners): number {
    // Get the two points that represent that furthest points on the frustum
    // assuming that's either the diagonal across the far plane or the diagonal
    // across the whole frustum itself.
    const nearCorners = frustum.near;
    const farCorners = frustum.far;
    let diagonalLength = Math.max(
      farCorners[0].distanceTo(farCorners[2]),
      farCorners[0].distanceTo(nearCorners[2]),
    );

    // Expand the shadow bounds by the fade width.
    if (this.fade) {
      const camera = this.mainCamera;
      const near = camera.near;
      const far = Math.min(camera.far, this.far);
      const distance = farCorners[0].z / (far - near);
      diagonalLength += 0.25 * distance ** 2 * (far - near);
    }
    return diagonalLength * 0.5;
  }

  private updateShadowBounds(): void {
    const frusta = this.cascadedFrusta;
    const lights = this.directionalLights.cascadedLights;
    invariant(frusta.length === lights.length);

    for (let i = 0; i < frusta.length; ++i) {
      const radius = this.getFrustumRadius(this.cascadedFrusta[i]);
      const light = lights[i];
      const camera = light.shadow.camera;
      camera.left = -radius;
      camera.right = radius;
      camera.top = radius;
      camera.bottom = -radius;
      camera.near = 0;
      camera.far = radius * 2 + this.margin;
      camera.updateProjectionMatrix();
    }
  }

  updateFrusta(): void {
    this.updateCascades();
    this.updateShadowBounds();
    this.materialStates.update(this);
  }

  update(): void {
    if (this.needsUpdateFrusta) {
      this.needsUpdateFrusta = false;
      this.updateFrusta();
    }

    const directionalLight = this.directionalLights;
    const lightDirection = vectorScratch1
      .copy(directionalLight.direction)
      .normalize();
    const lightOrientationMatrix = matrixScratch1.lookAt(
      new Vector3(),
      lightDirection,
      Object3D.DEFAULT_UP,
    );
    const cameraToLightMatrix = matrixScratch2.multiplyMatrices(
      matrixScratch2.copy(lightOrientationMatrix).invert(),
      this.mainCamera.matrixWorld,
    );

    const margin = this.margin;
    const mapSize = this.mapSize;
    const frusta = this.cascadedFrusta;
    const lights = directionalLight.cascadedLights;
    for (let i = 0; i < frusta.length; ++i) {
      const { near, far } = frustumScratch
        .copy(frusta[i])
        .applyMatrix4(cameraToLightMatrix);
      const bbox = boxScratch.makeEmpty();
      for (let j = 0; j < 4; j++) {
        bbox.expandByPoint(near[j]);
        bbox.expandByPoint(far[j]);
      }
      const center = bbox.getCenter(vectorScratch2);
      center.z = bbox.max.z + margin;

      // Round light-space translation to even texel increments.
      const light = lights[i];
      const { left, right, top, bottom } = light.shadow.camera;
      const texelWidth = (right - left) / mapSize;
      const texelHeight = (top - bottom) / mapSize;
      center.x = Math.round(center.x / texelWidth) * texelWidth;
      center.y = Math.round(center.y / texelHeight) * texelHeight;

      center.applyMatrix4(lightOrientationMatrix);
      light.position.copy(center);
      light.target.position.copy(center);
      light.target.position.add(lightDirection);
    }
  }

  get cascadeCount(): number {
    return this.directionalLights.cascadedLights.length;
  }

  set cascadeCount(value: number) {
    if (value !== this.cascadeCount) {
      this.directionalLights.setCount(value);
      this.needsUpdateFrusta = true;
    }
  }

  get mapSize(): number {
    return this.directionalLights.mainLight.shadow.mapSize.width;
  }

  set mapSize(value: number) {
    if (value !== this.mapSize) {
      const lights = this.directionalLights.cascadedLights;
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < lights.length; ++i) {
        const shadow = lights[i].shadow;
        shadow.mapSize.width = value;
        shadow.mapSize.height = value;
        if (shadow.map != null) {
          shadow.map.dispose();
          shadow.map = null;
        }
      }
    }
  }

  get far(): number {
    return this._far;
  }

  set far(value: number) {
    if (value !== this._far) {
      this._far = value;
      this.needsUpdateFrusta = true;
    }
  }

  get mode(): FrustumSplitMode {
    return this._mode;
  }

  set mode(value: FrustumSplitMode) {
    if (value !== this._mode) {
      this._mode = value;
      this.needsUpdateFrusta = true;
    }
  }

  get lambda(): number {
    return this._lambda;
  }

  set lambda(value: number) {
    if (value !== this._lambda) {
      this._lambda = value;
      this.needsUpdateFrusta = true;
    }
  }

  get margin(): number {
    return this._margin;
  }

  set margin(value: number) {
    if (value !== this._margin) {
      this._margin = value;
      this.needsUpdateFrusta = true;
    }
  }

  get fade(): boolean {
    return this._fade;
  }

  set fade(value: boolean) {
    if (value !== this._fade) {
      this._fade = value;
      this.needsUpdateFrusta = true;
    }
  }

  get disableLastCascadeCutoff(): boolean {
    return this._disableLastCascadeCutoff;
  }

  set disableLastCascadeCutoff(value: boolean) {
    if (value !== this._disableLastCascadeCutoff) {
      this._disableLastCascadeCutoff = value;
      this.needsUpdateFrusta = true;
    }
  }

  // Proxy properties for cascaded lights:

  get intensity(): number {
    return this.directionalLights.mainLight.intensity;
  }

  set intensity(value: number) {
    if (value !== this.intensity) {
      // Only the main (index 0) cascade light contributes direct
      // illumination. Clones at [1..] are shadow-only casters and must
      // keep intensity=0 so TSL graphs (which accumulate every
      // DirectionalLight via AnalyticLightNode, unlike the legacy GLSL
      // CSM shader which only uses `directionalLights[0]`) don't
      // over-illuminate by a factor of cascadeCount.
      this.directionalLights.cascadedLights[0].intensity = value;
    }
  }

  get shadowIntensity(): number {
    return this.directionalLights.mainLight.shadow.intensity;
  }

  set shadowIntensity(value: number) {
    if (value !== this.shadowIntensity) {
      const lights = this.directionalLights.cascadedLights;
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < lights.length; ++i) {
        lights[i].shadow.intensity = value;
      }
    }
  }

  get color(): Color {
    return this.directionalLights.mainLight.color;
  }

  set color(value: Color) {
    if (value !== this.color) {
      this.directionalLights.mainLight.color.copy(value);
    }
  }

  get bias(): number {
    return this.directionalLights.mainLight.shadow.bias;
  }

  set bias(value: number) {
    if (value !== this.bias) {
      const lights = this.directionalLights.cascadedLights;
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < lights.length; ++i) {
        lights[i].shadow.bias = value;
      }
    }
  }

  get normalBias(): number {
    return this.directionalLights.mainLight.shadow.normalBias;
  }

  set normalBias(value: number) {
    if (value !== this.normalBias) {
      const lights = this.directionalLights.cascadedLights;
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < lights.length; ++i) {
        lights[i].shadow.normalBias = value;
      }
    }
  }

  get radius(): number {
    return this.directionalLights.mainLight.shadow.radius;
  }

  set radius(value: number) {
    if (value !== this.radius) {
      const lights = this.directionalLights.cascadedLights;
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < lights.length; ++i) {
        lights[i].shadow.radius = value;
      }
    }
  }

  get blurSamples(): number {
    return this.directionalLights.mainLight.shadow.blurSamples;
  }

  set blurSamples(value: number) {
    if (value !== this.blurSamples) {
      const lights = this.directionalLights.cascadedLights;
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < lights.length; ++i) {
        lights[i].shadow.blurSamples = value;
      }
    }
  }
}
