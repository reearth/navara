import { eastNorthUpToFixedFrame, vector3ToGeodetic } from "@navara/three_api";
import fragmentShader from "@shaders/glsl/rain.frag.glsl";
import vertexShader from "@shaders/glsl/rain.vert.glsl";
import {
  BufferGeometry,
  type Camera,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  ShaderMaterial,
  TextureLoader,
  Uint16BufferAttribute,
  Uniform,
  Vector3,
  MathUtils,
  Matrix4,
  Texture,
  Vector2,
  Color,
} from "three";

import { RAIN_ASSETS_URL } from "../constants";

export type RainConfig = {
  particleCount: number;
  speed: number;
  color: number;
  areaWidth: number;
  areaHeight: number;
  width: number;
  height: number;
  radius: number;
  opacity: number;
  /** Raindrop texture URL */
  standardAssetUrl: string;
  /** Diffused raindrop texture URL */
  diffuseAssetUrl: string;
  /** Use a diffused raindrop texture */
  diffuse: boolean;
  /** The mesh follows a camera. It takes an effect that looks like the mesh is rendered infinitely. */
  followCamera: boolean;
  /** Opacity is reduced in proportion to the maximum height and the camera height. */
  maxHeight: number;
};

export const DefaultRainConfig: RainConfig = {
  particleCount: 10000,
  speed: 0.001,
  color: 0xffffff,
  areaWidth: 500,
  areaHeight: 1000,
  width: 0.5,
  height: 50,
  radius: 10,
  opacity: 0.5,
  // Raindrop is modeled by https://www.cs.columbia.edu/CAVE/publications/pdfs/Garg_TOG06.pdf.
  // The texture references https://cave.cs.columbia.edu/repository/Rain.
  standardAssetUrl: `${RAIN_ASSETS_URL}/raindrop_size16_osc5.webp`,
  diffuseAssetUrl: `${RAIN_ASSETS_URL}/raindrop_size16_osc0.webp`,
  diffuse: false,
  followCamera: false,
  maxHeight: 3000,
};

const RAINDROP_IMAGE_WIDTH = 1184;
const RAINDROP_IMAGE_HEIGHT = 1804;
const RAINDROP_IMAGE_VERTICAL_SIZES = [525, 494, 405, 272, 108];
const RAINDROP_IMAGE_HORIZONTAL_SIZE = 16;

// Camera angles in degrees
const CAMERA_ANGLES = [0, 20, 40, 60, 80];
// Light angles in degrees (horizontal)
const LIGHT_ANGLES_H = [10, 30, 50, 70, 90, 110, 130, 150, 170];
// Light angles in degrees (vertical) - includes negative angles
const LIGHT_ANGLES_V = [-90, -70, -50, -30, -10, 10, 30, 50, 70, 90];

/**
 * Find the closest value in an array and return its index
 * @param target Target value to find
 * @param array Array to search in
 * @returns Index of closest value
 */
function findClosestIndex(target: number, array: readonly number[]): number {
  return array.reduce((prev, curr, index) => {
    return Math.abs(curr - target) < Math.abs(array[prev] - target)
      ? index
      : prev;
  }, 0);
}

/**
 * Calculate angles from camera and light direction vectors
 * @param cameraDirection Direction from raindrop to camera (normalized)
 * @param lightDirection Direction from raindrop to light source (normalized)
 * @param rainDirection Direction of rain fall (default: downward)
 * @returns Object containing camera angle and light angles
 */
function calculateAnglesFromDirections(
  cameraDirection: Vector3,
  lightDirection: Vector3,
  rainDirection: Vector3 = new Vector3(0, -1, 0),
): { cameraAngle: number; lightAngleH: number; lightAngleV: number } {
  // Calculate camera angle (angle between camera direction and rain direction)
  const cameraAngle =
    Math.acos(Math.abs(cameraDirection.dot(rainDirection))) * MathUtils.RAD2DEG;

  // Calculate light angles relative to camera coordinate system
  // Create a coordinate system where Y is up (opposite of rain direction)
  const up = rainDirection.clone().negate();
  const right = new Vector3().crossVectors(up, cameraDirection).normalize();
  const forward = new Vector3().crossVectors(right, up).normalize();

  // Project light direction onto the camera coordinate system
  const lightH = lightDirection.dot(right);
  const lightV = lightDirection.dot(up);
  const lightF = lightDirection.dot(forward);

  // Calculate horizontal angle (azimuth)
  const lightAngleH = Math.atan2(lightH, lightF) * MathUtils.RAD2DEG;

  // Calculate vertical angle (elevation)
  const lightAngleV = Math.asin(lightV) * MathUtils.RAD2DEG;

  return {
    cameraAngle: Math.abs(cameraAngle),
    lightAngleH: Math.abs(lightAngleH),
    lightAngleV,
  };
}

/**
 * Calculate texture coordinates for a raindrop based on camera angle and light angle
 * @param cameraAngle Camera angle in degrees (0-80)
 * @param lightAngleH Horizontal light angle in degrees (10-170)
 * @param lightAngleV Vertical light angle in degrees (-90 to 90)
 * @returns Object containing UV scale and offset for texture sampling
 */
function calculateRaindropTextureCoords(
  cameraAngle: number,
  lightAngleH: number,
  lightAngleV: number,
): { uvScale: Vector2; uvOffset: Vector2 } {
  // Find closest camera angle
  const cameraIndex = findClosestIndex(cameraAngle, CAMERA_ANGLES);

  // Find closest horizontal light angle
  const lightHIndex = findClosestIndex(lightAngleH, LIGHT_ANGLES_H);

  // Find closest vertical light angle
  const lightVIndex = findClosestIndex(lightAngleV, LIGHT_ANGLES_V);

  // Calculate column index based on vertical and horizontal light angles
  const columnIndex = lightVIndex * LIGHT_ANGLES_H.length + lightHIndex;

  // Calculate UV coordinates
  const uvScaleX = RAINDROP_IMAGE_HORIZONTAL_SIZE / RAINDROP_IMAGE_WIDTH;
  const uvScaleY =
    RAINDROP_IMAGE_VERTICAL_SIZES[cameraIndex] / RAINDROP_IMAGE_HEIGHT;

  const uvOffsetX =
    (columnIndex * RAINDROP_IMAGE_HORIZONTAL_SIZE) / RAINDROP_IMAGE_WIDTH;

  // Calculate Y offset based on camera angle
  let uvOffsetY = 0;
  for (let i = 0; i < cameraIndex; i++) {
    uvOffsetY += RAINDROP_IMAGE_VERTICAL_SIZES[i] / RAINDROP_IMAGE_HEIGHT;
  }

  return {
    uvScale: new Vector2(uvScaleX, uvScaleY),
    uvOffset: new Vector2(uvOffsetX, uvOffsetY),
  };
}

class RainMaterial extends ShaderMaterial {
  public uniforms: {
    time: Uniform<number>;
    speed: Uniform<number>;
    color: Uniform<Color>;
    areaWidth: Uniform<number>;
    areaHeight: Uniform<number>;
    size: Uniform<Vector2>;
    opacity: Uniform<number>;
    texture0: Uniform<Texture | null>;
    uvScale: Uniform<Vector2>;
    uvOffset: Uniform<Vector2>;
    meshOffset: Uniform<Vector3>;
    bounds: Uniform<Vector3>;
    cameraRight: Uniform<Vector3>;
    cameraUp: Uniform<Vector3>;
    followCamera: Uniform<boolean>;
  };

  constructor() {
    super({
      fragmentShader,
      vertexShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: DoubleSide,
    });

    this.uniforms = {
      time: new Uniform(0),
      speed: new Uniform(2.0),
      color: new Uniform(new Color()),
      areaWidth: new Uniform(20.0),
      areaHeight: new Uniform(20.0),
      size: new Uniform(new Vector2(0.01, 0.5)),
      opacity: new Uniform(1.0),
      texture0: new Uniform(null),
      uvScale: new Uniform(
        new Vector2(
          RAINDROP_IMAGE_HORIZONTAL_SIZE / RAINDROP_IMAGE_WIDTH,
          RAINDROP_IMAGE_VERTICAL_SIZES[0] / RAINDROP_IMAGE_HEIGHT,
        ),
      ),
      uvOffset: new Uniform(new Vector2(0.0, 0.0)),
      cameraRight: new Uniform(new Vector3(1.0, 0.0, 0.0)),
      cameraUp: new Uniform(new Vector3(0.0, 1.0, 0.0)),
      meshOffset: new Uniform(new Vector3(0.0, 0.0, 0.0)),
      bounds: new Uniform(new Vector3(0, 0, 0)),
      followCamera: new Uniform(false),
    };
  }
}

const createGeometry = (config: RainConfig): BufferGeometry => {
  const { particleCount, radius } = config;
  const index: number[] = [];
  const vertices: number[] = [];
  const uvs: number[] = [];
  const offsets: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < particleCount; ++i) {
    const r = Math.sqrt(Math.random()) * radius;
    const theta = Math.random() * 2 * Math.PI;

    const px = r * Math.cos(theta);
    const py = Math.random();
    const pz = r * Math.sin(theta);

    for (let j = 0; j < 4; ++j) {
      index.push(i);
      vertices.push(px, py, pz);
    }
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    offsets.push(-1, -1, 1, -1, 1, 1, -1, 1);
    const vertexIndex = i * 4;
    indices.push(
      vertexIndex + 0,
      vertexIndex + 1,
      vertexIndex + 2,
      vertexIndex + 2,
      vertexIndex + 3,
      vertexIndex + 0,
    );
  }

  const geometry = new BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute("index", new Uint16BufferAttribute(index, 1));
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new Uint16BufferAttribute(uvs, 2));
  geometry.setAttribute("offset", new Float32BufferAttribute(offsets, 2));

  return geometry;
};

const DUMMY_VECTOR3 = new Vector3();

export class RainMesh extends Mesh<BufferGeometry, RainMaterial> {
  private readonly _config: RainConfig;
  private readonly _material: RainMaterial;
  private readonly _textureLoader: TextureLoader;
  private _lastCameraPosition: Vector3 | null = null;
  private readonly _cameraOffset: Vector3 = new Vector3();
  private readonly xAxisBase = new Vector3();
  private readonly yAxisBase = new Vector3();
  private readonly zAxisBase = new Vector3();
  private readonly baseMatrix4 = new Matrix4();

  constructor(config: Partial<RainConfig> = {}) {
    const fullConfig = { ...DefaultRainConfig, ...config };
    const geometry = createGeometry(fullConfig);
    const material = new RainMaterial();

    super(geometry, material);

    this._config = fullConfig;
    this._material = material;
    this._textureLoader = new TextureLoader();
    this.frustumCulled = false;

    this.updateUniforms();
    this.loadTexture();
  }

  private updateUniforms() {
    this._material.uniforms.speed.value = this._config.speed;
    this._material.uniforms.areaWidth.value = this._config.areaWidth;
    this._material.uniforms.areaHeight.value = this._config.areaHeight;
    this._material.uniforms.size.value.set(
      this._config.width,
      this._config.height,
    );
    this._material.uniforms.opacity.value = this._config.opacity;
    this._material.uniforms.followCamera.value = this._config.followCamera;

    this.updateBounds();
  }

  private updateBounds() {
    // Calculate bounds based on area and radius
    this._material.uniforms.bounds.value.set(
      this._config.areaWidth * this._config.radius,
      this._config.areaHeight,
      this._config.areaWidth * this._config.radius,
    );
  }

  // Setters and getters
  set particleCount(value: number) {
    if (value !== this._config.particleCount) {
      const oldConfig = { ...this._config };
      this._config.particleCount = value;
      if (value !== oldConfig.particleCount) {
        const newGeometry = createGeometry(this._config);
        this.geometry.dispose();
        this.geometry = newGeometry;
      }
    }
  }

  get particleCount(): number {
    return this._config.particleCount;
  }

  set speed(value: number) {
    this._config.speed = value;
    this._material.uniforms.speed.value = value;
  }

  get speed(): number {
    return this._config.speed;
  }

  set color(value: number) {
    this._config.color = value;
    this._material.uniforms.color.value.setHex(value);
  }

  get color(): number {
    return this._config.color;
  }

  set areaWidth(value: number) {
    this._config.areaWidth = value;
    this._material.uniforms.areaWidth.value = value;
    this.updateBounds();
  }

  get areaWidth(): number {
    return this._config.areaWidth;
  }

  set areaHeight(value: number) {
    this._config.areaHeight = value;
    this._material.uniforms.areaHeight.value = value;
    this.updateBounds();
  }

  get areaHeight(): number {
    return this._config.areaHeight;
  }

  set width(value: number) {
    this._config.width = value;
    this._material.uniforms.size.value.set(value, this._config.height);
  }

  get width(): number {
    return this._config.width;
  }

  set height(value: number) {
    this._config.height = value;
    this._material.uniforms.size.value.set(this._config.width, value);
  }

  get height(): number {
    return this._config.height;
  }

  set radius(value: number) {
    if (value !== this._config.radius) {
      this._config.radius = value;
      const newGeometry = createGeometry(this._config);
      this.geometry.dispose();
      this.geometry = newGeometry;

      this.updateBounds();
    }
  }

  get radius(): number {
    return this._config.radius;
  }

  set opacity(value: number) {
    this._config.opacity = value;
    this._material.uniforms.opacity.value = value;
  }

  get opacity(): number {
    return this._config.opacity;
  }

  set standardAssetUrl(value: string) {
    this._config.standardAssetUrl = value;
    if (!this._config.diffuse) {
      this.loadTexture();
    }
  }

  get standardAssetUrl(): string {
    return this._config.standardAssetUrl;
  }

  set diffuseAssetUrl(value: string) {
    this._config.diffuseAssetUrl = value;
    if (this._config.diffuse) {
      this.loadTexture();
    }
  }

  get diffuseAssetUrl(): string {
    return this._config.diffuseAssetUrl;
  }

  set diffuse(value: boolean) {
    this._config.diffuse = value;
    this.loadTexture(); // Reload texture when diffuse mode changes
  }

  get diffuse(): boolean {
    return this._config.diffuse;
  }

  set followCamera(value: boolean) {
    this._config.followCamera = value;
    this._material.uniforms.followCamera.value = value;

    // Reset tracking when followCamera is toggled
    if (value) {
      this._cameraOffset.set(0, 0, 0);
      this._lastCameraPosition = null;
    }
  }

  get followCamera(): boolean {
    return this._config.followCamera;
  }

  set maxHeight(value: number) {
    this._config.maxHeight = value;
  }

  get maxHeight(): number {
    return this._config.maxHeight;
  }

  private async loadTexture(): Promise<void> {
    // Choose texture based on diffuse mode
    const textureUrl = this._config.diffuse
      ? this._config.diffuseAssetUrl
      : this._config.standardAssetUrl;

    try {
      const texture = await this._textureLoader.loadAsync(textureUrl);
      this._material.uniforms.texture0.value = texture;
    } catch (error) {
      console.error("Failed to load texture:", error);
    }
  }

  updateConfig(newConfig: Partial<RainConfig>) {
    if (newConfig.particleCount !== undefined)
      this.particleCount = newConfig.particleCount;
    if (newConfig.speed !== undefined) this.speed = newConfig.speed;
    if (newConfig.color !== undefined) this.color = newConfig.color;
    if (newConfig.areaWidth !== undefined) this.areaWidth = newConfig.areaWidth;
    if (newConfig.areaHeight !== undefined)
      this.areaHeight = newConfig.areaHeight;
    if (newConfig.width !== undefined) this.width = newConfig.width;
    if (newConfig.height !== undefined) this.height = newConfig.height;
    if (newConfig.radius !== undefined) this.radius = newConfig.radius;
    if (newConfig.opacity !== undefined) this.opacity = newConfig.opacity;
    if (newConfig.standardAssetUrl !== undefined)
      this.standardAssetUrl = newConfig.standardAssetUrl;
    if (newConfig.diffuseAssetUrl !== undefined)
      this.diffuseAssetUrl = newConfig.diffuseAssetUrl;
    if (newConfig.diffuse !== undefined) this.diffuse = newConfig.diffuse;
    if (newConfig.followCamera !== undefined)
      this.followCamera = newConfig.followCamera;
    if (newConfig.maxHeight !== undefined) this.maxHeight = newConfig.maxHeight;
  }

  getConfig(): RainConfig {
    return { ...this._config };
  }

  setTexture(texture: Texture) {
    this._material.uniforms.texture0.value = texture;
  }

  updateTextureCoordinates(
    cameraAngle: number,
    lightAngleH: number,
    lightAngleV: number,
  ) {
    const coords = calculateRaindropTextureCoords(
      cameraAngle,
      lightAngleH,
      lightAngleV,
    );
    this._material.uniforms.uvScale.value.copy(coords.uvScale);
    this._material.uniforms.uvOffset.value.copy(coords.uvOffset);
  }

  updateTextureCoordinatesFromDirections(
    cameraDirection: Vector3,
    lightDirection: Vector3,
    rainDirection?: Vector3,
  ) {
    const angles = calculateAnglesFromDirections(
      cameraDirection,
      lightDirection,
      rainDirection,
    );
    this.updateTextureCoordinates(
      angles.cameraAngle,
      angles.lightAngleH,
      angles.lightAngleV,
    );
  }

  /**
   *
   * @param time
   * @param camera
   * @param lightDirection Raindrop texture is changed depending on the light direction.
   */
  update(time: number, camera: Camera, lightDirection?: Vector3) {
    this.updateTime(time);

    if (this.maxHeight !== Infinity) {
      const geodesic = vector3ToGeodetic(camera.position);
      this.material.uniforms.opacity.value =
        this.opacity * Math.max(1 - geodesic.height / this.maxHeight, 0);
    }

    const localTransform = eastNorthUpToFixedFrame(camera.position);
    // Extract the y axis(up direction) on the ellipsoid at this position
    localTransform.extractBasis(DUMMY_VECTOR3, DUMMY_VECTOR3, this.yAxisBase);
    // Extract the x axis from the camera.
    camera.matrixWorld.extractBasis(
      this.xAxisBase,
      DUMMY_VECTOR3,
      DUMMY_VECTOR3,
    );
    // Calculate z axis from x and y axis.
    this.zAxisBase.crossVectors(this.xAxisBase, this.yAxisBase);

    const basis = this.baseMatrix4.makeBasis(
      this.xAxisBase,
      this.yAxisBase,
      this.zAxisBase,
    );

    this.setRotationFromMatrix(basis);

    // If follow camera mode is enabled, update rain mesh position to follow camera
    if (this._config.followCamera) {
      // Initialize camera position tracking on first frame
      if (!this._lastCameraPosition) {
        this._lastCameraPosition = camera.position.clone();
        this._cameraOffset.set(0, 0, 0);
      }

      // Calculate camera movement since last frame
      const cameraMovement = new Vector3().subVectors(
        camera.position,
        this._lastCameraPosition,
      );

      // Transform camera movement from world space to mesh local space
      // This ensures the offset is calculated relative to the mesh's oriented coordinate system
      const localMovement = cameraMovement.clone();

      // Create inverse rotation matrix to transform world movement to local space
      const inverseRotationMatrix = new Matrix4();
      inverseRotationMatrix.extractRotation(basis);
      inverseRotationMatrix.invert();

      localMovement.applyMatrix4(inverseRotationMatrix);

      // Accumulate the offset (particles move opposite to camera movement)
      this._cameraOffset.sub(localMovement);

      // Wrap the offset within bounds to prevent it from growing infinitely
      const bounds = this._material.uniforms.bounds.value;
      this._cameraOffset.x =
        ((this._cameraOffset.x % bounds.x) + bounds.x) % bounds.x;
      this._cameraOffset.y =
        ((this._cameraOffset.y % bounds.y) + bounds.y) % bounds.y;
      this._cameraOffset.z =
        ((this._cameraOffset.z % bounds.z) + bounds.z) % bounds.z;

      // Update shader uniforms
      this._material.uniforms.meshOffset.value.copy(this._cameraOffset);

      // Position rain mesh slightly in front of camera to avoid clipping and visibility issues
      this.position.copy(camera.position);

      // Update last camera position for next frame
      this._lastCameraPosition.copy(camera.position);
    } else {
      // Reset camera tracking when followCamera is disabled
      this._lastCameraPosition = null;
      this._cameraOffset.set(0, 0, 0);
    }

    // If dynamic angles mode is enabled, calculate angles automatically
    if (lightDirection) {
      const cameraDirectionToModel = new Vector3();
      if (this.followCamera) {
        camera.getWorldDirection(cameraDirectionToModel);
      } else {
        cameraDirectionToModel
          .subVectors(this.position, camera.position)
          .normalize();
      }

      const lightDirectionToModel = lightDirection.clone().negate().normalize();
      this.updateTextureCoordinatesFromDirections(
        cameraDirectionToModel,
        lightDirectionToModel,
      );
    }
  }

  updateTime(time: number) {
    this._material.uniforms.time.value = time;
  }

  dispose() {
    this.geometry.dispose();
    this._material.dispose();
  }
}
