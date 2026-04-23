import type { XYZ } from "@navara/three";
import {
  createReplacer,
  eastNorthUpToFixedFrame,
  vector3ToGeodetic,
} from "@navara/three";
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
    movementStrength: Uniform<Vector3>;
    movementSpeed: Uniform<Vector3>;
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
      movementStrength: new Uniform(new Vector3()),
      movementSpeed: new Uniform(new Vector3()),
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
    shader.uniforms.movementStrength = this.uniforms.movementStrength;
    shader.uniforms.movementSpeed = this.uniforms.movementSpeed;
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
         uniform vec3 movementStrength;
         uniform vec3 movementSpeed;
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
         float xMovement = movementStrength.x * sin(time * movementSpeed.x + particleIndex * 0.3);
         transformed.x += xMovement;

         // Add vertical movement
         float yMovement = movementStrength.y * cos(time * movementSpeed.y + particleIndex * 0.2);
         transformed.y += yMovement;

         // Add horizontal Z movement
         float zMovement = movementStrength.z * sin(time * movementSpeed.z + particleIndex * 0.1);
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
float snowReflectivity = 0.2;
vec3 lightColor = snowReflectivity * getDirLightColor();
vec3 irradiance = getIrradiance(vec3(0.0, 0.0, -1.0));

vec3 direct = lightColor * BRDF_Lambert(diffuseColor.rgb);
vec3 indirect = irradiance * BRDF_Lambert(diffuseColor.rgb);

outgoingLight = direct + indirect;
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
  movementStrength: XYZ;
  movementSpeed: XYZ;
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
  movementStrength: {
    x: 50,
    y: 20,
    z: 50,
  },
  movementSpeed: {
    x: 0.0005,
    y: 0.0002,
    z: 0.0005,
  },
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
      movementStrength,
      movementSpeed,
      radius,
      followCamera,
    } = this._config;

    this._material.uniforms.areaHeight.value = areaHeight;
    this._material.uniforms.areaWidth.value = areaWidth;
    this._material.uniforms.speed.value = speed;
    this._material.uniforms.movementStrength.value.copy(movementStrength);
    this._material.uniforms.movementSpeed.value.copy(movementSpeed);
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

  set movementStrength(value: XYZ) {
    this._config.movementStrength = value;
    this._material.uniforms.movementStrength.value.copy(value);
  }

  get movementStrength(): XYZ {
    return this._config.movementStrength;
  }

  set movementSpeed(value: XYZ) {
    this._config.movementSpeed = value;
    this._material.uniforms.movementSpeed.value.copy(value);
  }

  get movementSpeed(): XYZ {
    return this._config.movementSpeed;
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
    if (newConfig.movementStrength !== undefined)
      this.movementStrength = newConfig.movementStrength;
    if (newConfig.movementSpeed !== undefined)
      this.movementSpeed = newConfig.movementSpeed;
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
