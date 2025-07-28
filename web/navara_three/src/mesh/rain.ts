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
  Uint16BufferAttribute,
  Uniform,
  Vector3,
  Matrix4,
  Vector2,
  Color,
  UniformsLib,
} from "three";

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
  /** Maximum alpha value for the lit side of raindrops */
  alphaMax: number;
  /** Minimum alpha value for the shadowed side of raindrops */
  alphaMin: number;
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
  width: 0.3,
  height: 50,
  radius: 10,
  opacity: 0.5,
  alphaMax: 0.5,
  alphaMin: 0.05,
  followCamera: false,
  maxHeight: 3000,
};

class RainMaterial extends ShaderMaterial {
  public uniforms: {
    time: Uniform<number>;
    speed: Uniform<number>;
    color: Uniform<Color>;
    areaWidth: Uniform<number>;
    areaHeight: Uniform<number>;
    size: Uniform<Vector2>;
    opacity: Uniform<number>;
    alphaMax: Uniform<number>;
    alphaMin: Uniform<number>;
    meshOffset: Uniform<Vector3>;
    bounds: Uniform<Vector3>;
    cameraRight: Uniform<Vector3>;
    cameraUp: Uniform<Vector3>;
    xAxisBase: Uniform<Vector3>;
    yAxisBase: Uniform<Vector3>;
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
      lights: true,
      defines: {},
    });

    this.uniforms = {
      ...UniformsLib.common,
      ...UniformsLib.lights,
      time: new Uniform(0),
      speed: new Uniform(2.0),
      color: new Uniform(new Color()),
      areaWidth: new Uniform(20.0),
      areaHeight: new Uniform(20.0),
      size: new Uniform(new Vector2(0.01, 0.5)),
      opacity: new Uniform(0.5),
      alphaMax: new Uniform(0.3),
      alphaMin: new Uniform(0.01),
      cameraRight: new Uniform(new Vector3(1.0, 0.0, 0.0)),
      cameraUp: new Uniform(new Vector3(0.0, 1.0, 0.0)),
      xAxisBase: new Uniform(new Vector3(1.0, 0.0, 0.0)),
      yAxisBase: new Uniform(new Vector3(0.0, 1.0, 0.0)),
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
  geometry.setAttribute("offset", new Float32BufferAttribute(offsets, 2));

  return geometry;
};

const DUMMY_VECTOR3 = new Vector3();

export class RainMesh extends Mesh<BufferGeometry, RainMaterial> {
  private readonly _config: RainConfig;
  private readonly _material: RainMaterial;
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
    this.frustumCulled = false;

    this.updateUniforms();
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
    this._material.uniforms.alphaMax.value = this._config.alphaMax;
    this._material.uniforms.alphaMin.value = this._config.alphaMin;
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

  set alphaMax(value: number) {
    this._config.alphaMax = value;
    this._material.uniforms.alphaMax.value = value;
  }

  get alphaMax(): number {
    return this._config.alphaMax;
  }

  set alphaMin(value: number) {
    this._config.alphaMin = value;
    this._material.uniforms.alphaMin.value = value;
  }

  get alphaMin(): number {
    return this._config.alphaMin;
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
    if (newConfig.alphaMax !== undefined) this.alphaMax = newConfig.alphaMax;
    if (newConfig.alphaMin !== undefined) this.alphaMin = newConfig.alphaMin;
    if (newConfig.followCamera !== undefined)
      this.followCamera = newConfig.followCamera;
    if (newConfig.maxHeight !== undefined) this.maxHeight = newConfig.maxHeight;
  }

  getConfig(): RainConfig {
    return { ...this._config };
  }

  /**
   * Update the rain mesh
   * @param time Current time
   * @param camera Camera instance
   */
  update(time: number, camera: Camera) {
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

    // Update axis vectors for light direction transformation in shader
    this._material.uniforms.xAxisBase.value.copy(this.xAxisBase);
    this._material.uniforms.yAxisBase.value.copy(this.yAxisBase);

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
  }

  updateTime(time: number) {
    this._material.uniforms.time.value = time;
  }

  dispose() {
    this.geometry.dispose();
    this._material.dispose();
  }
}
