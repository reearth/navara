import { eastNorthUpToFixedFrame, vector3ToGeodetic } from "@navara/three_api";
import SimpleLightShaderChunk from "@shaders/glsl/chunks/simple_lights.glsl";
import {
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  Points,
  Uniform,
  Vector3,
  type WebGLProgramParametersWithUniforms,
  Matrix4,
  Camera,
  ShaderMaterial,
  ShaderChunk,
  UniformsLib,
  Color,
} from "three";
import invariant from "tiny-invariant";

import { createReplacer } from "../utils";

const createSnowflakeTexture = (): CanvasTexture => {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext("2d");
  invariant(context);

  // Create radial gradient for snowflake
  const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

  context.fillStyle = gradient;
  context.fillRect(0, 0, 32, 32);

  return new CanvasTexture(canvas);
};

class SnowPointsMaterial extends ShaderMaterial {
  public uniforms: (typeof UniformsLib)["points"] & {
    areaWidth: Uniform<number>;
    areaHeight: Uniform<number>;
    speed: Uniform<number>;
    time: Uniform<number>;
    xMovementStrength: Uniform<number>;
    xMovementSpeed: Uniform<number>;
    zMovementStrength: Uniform<number>;
    zMovementSpeed: Uniform<number>;
    yMovementStrength: Uniform<number>;
    yMovementSpeed: Uniform<number>;
    cameraPosition: Uniform<Vector3>;
    meshOffset: Uniform<Vector3>;
    bounds: Uniform<Vector3>;
    followCamera: Uniform<boolean>;
  };

  isPointsMaterial = true;

  color = new Color(0xffffff);
  map = createSnowflakeTexture();
  size = 0.05;
  fog = true;
  sizeAttenuation = true;

  constructor() {
    super({
      vertexShader: ShaderChunk.points_vert,
      fragmentShader: ShaderChunk.points_frag,
      transparent: true,
      depthWrite: false,
      lights: true,
    });

    this.uniforms = {
      ...UniformsLib.points,
      ...UniformsLib.lights,
      areaWidth: new Uniform(20),
      areaHeight: new Uniform(20),
      speed: new Uniform(0.05),
      time: new Uniform(0),
      xMovementStrength: new Uniform(2),
      xMovementSpeed: new Uniform(0.5),
      yMovementStrength: new Uniform(1),
      yMovementSpeed: new Uniform(0.3),
      zMovementStrength: new Uniform(2),
      zMovementSpeed: new Uniform(0.2),
      cameraPosition: new Uniform(new Vector3()),
      meshOffset: new Uniform(new Vector3()),
      bounds: new Uniform(new Vector3()),
      followCamera: new Uniform(false),
    };
  }

  onBeforeCompile(shader: WebGLProgramParametersWithUniforms) {
    shader.uniforms.time = this.uniforms.time;
    shader.uniforms.areaWidth = this.uniforms.areaWidth;
    shader.uniforms.areaHeight = this.uniforms.areaHeight;
    shader.uniforms.speed = this.uniforms.speed;
    shader.uniforms.xMovementStrength = this.uniforms.xMovementStrength;
    shader.uniforms.xMovementSpeed = this.uniforms.xMovementSpeed;
    shader.uniforms.yMovementStrength = this.uniforms.yMovementStrength;
    shader.uniforms.yMovementSpeed = this.uniforms.yMovementSpeed;
    shader.uniforms.zMovementStrength = this.uniforms.zMovementStrength;
    shader.uniforms.zMovementSpeed = this.uniforms.zMovementSpeed;
    shader.uniforms.cameraPosition = this.uniforms.cameraPosition;
    shader.uniforms.meshOffset = this.uniforms.meshOffset;
    shader.uniforms.bounds = this.uniforms.bounds;
    shader.uniforms.followCamera = this.uniforms.followCamera;

    shader.vertexShader = createReplacer(shader.vertexShader)
      .replace(
        "uniform float size;",
        `uniform float size;
         uniform float speed;
         uniform float areaWidth;
         uniform float areaHeight;
         uniform float xMovementStrength;
         uniform float xMovementSpeed;
         uniform float zMovementStrength;
         uniform float zMovementSpeed;
         uniform float yMovementStrength;
         uniform float yMovementSpeed;
         attribute float particleIndex;
         uniform float time;
         uniform vec3 meshOffset;
         uniform vec3 bounds;
         uniform bool followCamera;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         
         // Add time-based falling motion
         transformed.y = areaHeight * (fract(transformed.y - time * speed) - 0.3);

         transformed.xz *= areaWidth;
         
         // Add horizontal X movement
         float xMovement = xMovementStrength * sin(time * xMovementSpeed + particleIndex * 0.3);
         transformed.x += xMovement;
  
         // Add vertical movement
         float yMovement = yMovementStrength * cos(time * yMovementSpeed + particleIndex * 0.2);
         transformed.y += yMovement;
  
         // Add horizontal Z movement
         float zMovement = zMovementStrength * sin(time * zMovementSpeed + particleIndex * 0.1);
         transformed.z += zMovement;
         
         // Apply infinite scrolling when followCamera is enabled
         if (followCamera) {
           // Apply mesh offset to vertices
           vec3 offsetPos = transformed + meshOffset;

           // Wrap particles around the bounds
           offsetPos.x = mod(offsetPos.x + bounds.x, bounds.x) - bounds.x * 0.5;
           offsetPos.y = mod(offsetPos.y + bounds.y * 0.5, bounds.y) - bounds.y * 0.5;
           offsetPos.z = mod(offsetPos.z + bounds.z * 0.5, bounds.z) - bounds.z * 0.5;
           
           transformed = offsetPos;
         }`,
      ).source;

    shader.fragmentShader = createReplacer(shader.fragmentShader)
      .replace(
        "#include <common>",
        `
#include <common>
#include <lights_pars_begin>
${SimpleLightShaderChunk}
`,
      )
      .replace(
        "outgoingLight = diffuseColor.rgb",
        `
vec3 lightColor = getDirLightColor();
vec3 irradiance = getIrradiance(vec3(0.0, 0.0, -1.0));

lightColor += irradiance;

outgoingLight = diffuseColor.rgb * lightColor;
`,
      ).source;
  }
}

const DUMMY_VECTOR3 = new Vector3();

export type SnowConfig = {
  particleCount: number;
  radius: number;
  areaWidth: number;
  areaHeight: number;
  speed: number;
  size: number;
  color: number;
  xMovementStrength: number;
  xMovementSpeed: number;
  zMovementStrength: number;
  zMovementSpeed: number;
  yMovementStrength: number;
  yMovementSpeed: number;
  /** The mesh follows a camera. It takes an effect that looks like the mesh is rendered infinitely. */
  followCamera: boolean;
  /** Opacity is reduced in proportion to the maximum height and the camera height. */
  maxHeight: number;
  opacity: number;
};

export const DefaultSnowConfig: SnowConfig = {
  particleCount: 30000,
  areaWidth: 500,
  areaHeight: 1000,
  radius: 10,
  speed: 0.00005,
  size: 3,
  color: 0xffffff,
  xMovementStrength: 50,
  xMovementSpeed: 0.0005,
  yMovementStrength: 20,
  yMovementSpeed: 0.0002,
  zMovementStrength: 50,
  zMovementSpeed: 0.0005,
  followCamera: true,
  maxHeight: 3000,
  opacity: 1,
};

export class SnowMesh extends Points<BufferGeometry, SnowPointsMaterial> {
  private readonly _config: SnowConfig;
  private readonly _material: SnowPointsMaterial;
  private readonly _lastCameraPosition: Vector3;
  private readonly _cameraOffset: Vector3;
  private readonly xAxisBase = new Vector3();
  private readonly yAxisBase = new Vector3();
  private readonly zAxisBase = new Vector3();
  private readonly baseMatrix4 = new Matrix4();

  constructor(config: Partial<SnowConfig> = {}) {
    const fullConfig = { ...DefaultSnowConfig, ...config };
    const geometry = new BufferGeometry();
    const material = new SnowPointsMaterial();

    super(geometry, material);

    this._config = fullConfig;
    this._material = material;
    this._lastCameraPosition = new Vector3();
    this._cameraOffset = new Vector3();
    this.frustumCulled = false;

    this.initializeGeometry();
    this.updateMaterial();
  }

  private initializeGeometry() {
    const { particleCount, radius } = this._config;
    const positions = new Float32Array(particleCount * 3);
    const particleIndices = new Float32Array(particleCount);

    // Initialize snowflake positions
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const r = Math.sqrt(Math.random()) * radius;
      const theta = Math.random() * 2 * Math.PI;

      const x = r * Math.cos(theta);
      const y = Math.random();
      const z = r * Math.sin(theta);

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      particleIndices[i] = i;
    }

    this.geometry.setAttribute(
      "position",
      new Float32BufferAttribute(positions, 3),
    );
    this.geometry.setAttribute(
      "particleIndex",
      new Float32BufferAttribute(particleIndices, 1),
    );
  }

  private updateMaterial() {
    const {
      areaHeight,
      areaWidth,
      speed,
      size,
      color,
      xMovementStrength,
      xMovementSpeed,
      zMovementStrength,
      zMovementSpeed,
      yMovementStrength,
      yMovementSpeed,
      radius,
      followCamera,
    } = this._config;

    this._material.uniforms.areaHeight.value = areaHeight;
    this._material.uniforms.areaWidth.value = areaWidth;
    this._material.uniforms.speed.value = speed;
    this._material.uniforms.xMovementStrength.value = xMovementStrength;
    this._material.uniforms.xMovementSpeed.value = xMovementSpeed;
    this._material.uniforms.yMovementStrength.value = yMovementStrength;
    this._material.uniforms.yMovementSpeed.value = yMovementSpeed;
    this._material.uniforms.zMovementStrength.value = zMovementStrength;
    this._material.uniforms.zMovementSpeed.value = zMovementSpeed;
    this._material.uniforms.bounds.value.set(
      areaWidth * radius,
      areaHeight,
      areaWidth * radius,
    );
    this._material.uniforms.followCamera.value = followCamera;
    this._material.size = size;
    this._material.color.setHex(color);
  }

  // Setters and getters
  set particleCount(value: number) {
    if (value !== this._config.particleCount) {
      const oldConfig = { ...this._config };
      this._config.particleCount = value;
      if (value !== oldConfig.particleCount) {
        this.initializeGeometry();
      }
    }
  }

  get particleCount(): number {
    return this._config.particleCount;
  }

  set radius(value: number) {
    if (value !== this._config.radius) {
      const oldConfig = { ...this._config };
      this._config.radius = value;
      if (value !== oldConfig.radius) {
        this.initializeGeometry();
        this._material.uniforms.bounds.value.x = value;
        this._material.uniforms.bounds.value.z = value;
      }
    }
  }

  get radius(): number {
    return this._config.radius;
  }

  set areaWidth(value: number) {
    this._config.areaWidth = value;
    this._material.uniforms.areaWidth.value = value;
    this._material.uniforms.bounds.value.x = value * this.radius;
    this._material.uniforms.bounds.value.z = value * this.radius;
  }

  get areaWidth(): number {
    return this._config.areaWidth;
  }

  set areaHeight(value: number) {
    this._config.areaHeight = value;
    this._material.uniforms.areaHeight.value = value;
    this._material.uniforms.bounds.value.y = value;
  }

  get areaHeight(): number {
    return this._config.areaHeight;
  }

  set speed(value: number) {
    this._config.speed = value;
    this._material.uniforms.speed.value = value;
  }

  get speed(): number {
    return this._config.speed;
  }

  set size(value: number) {
    this._config.size = value;
    this._material.size = value;
  }

  get size(): number {
    return this._config.size;
  }

  set color(value: number) {
    this._config.color = value;
    this._material.color.setHex(value);
  }

  get color(): number {
    return this._config.color;
  }

  set xMovementStrength(value: number) {
    this._config.xMovementStrength = value;
    this._material.uniforms.xMovementStrength.value = value;
  }

  get xMovementStrength(): number {
    return this._config.xMovementStrength;
  }

  set xMovementSpeed(value: number) {
    this._config.xMovementSpeed = value;
    this._material.uniforms.xMovementSpeed.value = value;
  }

  get xMovementSpeed(): number {
    return this._config.xMovementSpeed;
  }

  set yMovementStrength(value: number) {
    this._config.yMovementStrength = value;
    this._material.uniforms.yMovementStrength.value = value;
  }

  get yMovementStrength(): number {
    return this._config.yMovementStrength;
  }

  set yMovementSpeed(value: number) {
    this._config.yMovementSpeed = value;
    this._material.uniforms.yMovementSpeed.value = value;
  }

  get yMovementSpeed(): number {
    return this._config.yMovementSpeed;
  }

  set zMovementStrength(value: number) {
    this._config.zMovementStrength = value;
    this._material.uniforms.zMovementStrength.value = value;
  }

  get zMovementStrength(): number {
    return this._config.zMovementStrength;
  }

  set zMovementSpeed(value: number) {
    this._config.zMovementSpeed = value;
    this._material.uniforms.zMovementSpeed.value = value;
  }

  get zMovementSpeed(): number {
    return this._config.zMovementSpeed;
  }

  set followCamera(value: boolean) {
    this._config.followCamera = value;
    this._material.uniforms.followCamera.value = value;

    // Reset tracking when followCamera is toggled
    if (value) {
      this._cameraOffset.set(0, 0, 0);
      this._lastCameraPosition.set(0, 0, 0);
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

  set opacity(value: number) {
    this._config.opacity = value;
    this.material.opacity = value;
  }

  get opacity(): number {
    return this._config.opacity;
  }

  updateConfig(newConfig: Partial<SnowConfig>) {
    if (newConfig.particleCount !== undefined)
      this.particleCount = newConfig.particleCount;
    if (newConfig.radius !== undefined) this.radius = newConfig.radius;
    if (newConfig.areaWidth !== undefined) this.areaWidth = newConfig.areaWidth;
    if (newConfig.areaHeight !== undefined)
      this.areaHeight = newConfig.areaHeight;
    if (newConfig.speed !== undefined) this.speed = newConfig.speed;
    if (newConfig.size !== undefined) this.size = newConfig.size;
    if (newConfig.opacity !== undefined) this.opacity = newConfig.opacity;
    if (newConfig.color !== undefined) this.color = newConfig.color;
    if (newConfig.xMovementStrength !== undefined)
      this.xMovementStrength = newConfig.xMovementStrength;
    if (newConfig.xMovementSpeed !== undefined)
      this.xMovementSpeed = newConfig.xMovementSpeed;
    if (newConfig.yMovementStrength !== undefined)
      this.yMovementStrength = newConfig.yMovementStrength;
    if (newConfig.yMovementSpeed !== undefined)
      this.yMovementSpeed = newConfig.yMovementSpeed;
    if (newConfig.zMovementStrength !== undefined)
      this.zMovementStrength = newConfig.zMovementStrength;
    if (newConfig.zMovementSpeed !== undefined)
      this.zMovementSpeed = newConfig.zMovementSpeed;
    if (newConfig.followCamera !== undefined)
      this.followCamera = newConfig.followCamera;
  }

  getConfig(): SnowConfig {
    return { ...this._config };
  }

  update(time: number, camera: Camera) {
    this.updateTime(time);

    if (this.maxHeight !== Infinity) {
      const geodesic = vector3ToGeodetic(camera.position);
      this.material.opacity =
        this.opacity * Math.max(1 - geodesic.height / this.maxHeight, 0);
    }

    const localTransform = eastNorthUpToFixedFrame(camera.position);
    // Extract the up axis on the ellipsoid at this position
    localTransform.extractBasis(DUMMY_VECTOR3, DUMMY_VECTOR3, this.yAxisBase);
    // Extract the x axis from the camera.
    camera.matrix.extractBasis(this.xAxisBase, DUMMY_VECTOR3, DUMMY_VECTOR3);
    // Calculate z axis from x and y axis.
    this.zAxisBase.crossVectors(this.xAxisBase, this.yAxisBase);

    const basis = this.baseMatrix4.makeBasis(
      this.xAxisBase,
      this.yAxisBase,
      this.zAxisBase,
    );

    this.setRotationFromMatrix(basis);

    // If follow camera mode is enabled, update snow mesh position to follow camera
    if (this._config.followCamera) {
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

      // Update shader uniform with the accumulated offset
      this._material.uniforms.meshOffset.value.copy(this._cameraOffset);

      // Update last camera position for next frame
      this._lastCameraPosition.copy(camera.position);

      // Keep mesh position in sync with camera
      this.position.copy(camera.position);
    }
  }

  updateTime(time: number) {
    this._material.uniforms.time.value = time;
  }

  public dispose() {
    this.geometry.dispose();
    this._material.dispose();
  }
}
