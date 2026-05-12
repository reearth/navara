/**
 * FlyingModelPlugin — Navara Plugin for keyboard-driven GLTF model flight.
 *
 * Loads a GLTF model onto the globe, moves it via WASD / arrow keys with
 * a chase camera, and broadcasts position state on every frame.
 * The plugin is model-agnostic — any animated GLTF with gliding / flapping
 * clips can be used.
 *
 * ## Usage
 *
 * ```ts
 * import ThreeView from "@navara/three";
 * import { DefaultPlugin } from "@navara/three_default_plugin";
 * import { FlyingModelPlugin } from "@navara/three_plugins";
 *
 * const view = new ThreeView({ container, animation: true });
 * const defaultPlugin = new DefaultPlugin();
 * const flyingModel = new FlyingModelPlugin({
 *   modelUrl: "/glTF/my_model/scene.gltf",
 *   animation: {
 *     idleClip: "Idle",
 *     dashClip: "Run",
 *     speed: 1.0,
 *     crossfadeDuration: 0.3,
 *   },
 *   modelRotationOffset: { x: 0, y: 0, z: 0 },
 *   startLat: 35.6812,
 *   startLng: 139.7671,
 *   startHeight: 500,
 * });
 *
 * view.addPlugin(defaultPlugin);
 * view.addPlugin(flyingModel);
 * await view.init();
 *
 * flyingModel.start();
 *
 * const unsub = flyingModel.onStateChange((state) => {
 *   console.log(state.lat, state.lng, state.alt);
 * });
 *
 * flyingModel.teleport(lng, lat, alt, headingDeg);
 *
 * unsub();
 * flyingModel.dispose();
 * ```
 */
import ThreeView, {
  Plugin,
  MeshHandle,
  geodeticToVector3,
  vector3ToGeodetic,
  eastNorthUpToFixedFrame,
  degreeToRadian,
  radianToDegree,
  type ViewContext,
} from "@navara/three";
import type { DefaultDescriptions } from "@navara/three_default_plugin";
import { Vector3, Matrix4 } from "three";

type View = ThreeView<DefaultDescriptions>;

export type FlyingModelState = {
  lng: number;
  lat: number;
  alt: number;
  /** Heading (yaw) in degrees — 0 = north, 90 = east. */
  heading: number;
  speed: number;
  animationState: string;
};

/**
 * Model rotation offset applied to the loaded GLTF model.
 * Different models face different directions by default, so this
 * allows you to correct the orientation.
 */
export type ModelRotationOffset = {
  x: number;
  y: number;
  z: number;
};

/**
 * Animation configuration for the model.
 * Clip names are model-specific — check your GLTF file for available clips.
 */
export type AnimationConfig = {
  /** Clip name played while the model is idle or moving normally. */
  idleClip: string;
  /** Clip name played while the model is dashing (shift held). */
  dashClip: string;
  /** Playback speed multiplier. */
  speed: number;
  /** Duration in seconds for cross-fade transitions between clips. */
  crossfadeDuration: number;
};

export type FlyingModelConfig = {
  /** URL of the GLTF model to load. */
  modelUrl: string;
  /** Animation clip configuration. */
  animation: AnimationConfig;
  /** Rotation offset to correct the model's default orientation. */
  modelRotationOffset?: ModelRotationOffset;
  /** m/s */
  flightSpeed?: number;
  /** deg/frame */
  rotationSpeed?: number;
  /** m/s */
  altSpeed?: number;
  minAlt?: number;
  maxAlt?: number;
  modelScale?: number;
  cameraDistance?: number;
  cameraHeight?: number;
  cameraLerpSpeed?: number;
  startLat?: number;
  startLng?: number;
  startHeight?: number;
  /** radians */
  startYaw?: number;
};

type StateListener = (s: FlyingModelState) => void;

const DEFAULT_ROTATION_OFFSET: ModelRotationOffset = {
  x: 0,
  y: 0,
  z: 0,
};

type FlyingModelDefaults = Required<
  Omit<FlyingModelConfig, "modelUrl" | "animation">
>;

const DEFAULTS: FlyingModelDefaults = {
  flightSpeed: 50,
  rotationSpeed: 3,
  altSpeed: 30,
  minAlt: 50,
  maxAlt: 5000,
  modelScale: 3,
  cameraDistance: 50,
  cameraHeight: 20,
  cameraLerpSpeed: 3,
  startLat: 35.6812,
  startLng: 139.7671,
  startHeight: 500,
  startYaw: Math.PI * 1.3,
  modelRotationOffset: DEFAULT_ROTATION_OFFSET,
};

/**
 * Register via `view.addPlugin(plugin)` **before** `view.init()`,
 * then call `start()` after initialization completes.
 *
 * ### Controls
 *
 * | Key | Action |
 * |-----|--------|
 * | W / S | Forward / backward |
 * | A / D | Turn left / right |
 * | Arrow Up / Down | Climb / descend |
 * | Shift | Dash (2.5x speed) |
 * | Alt | Orbit camera mode |
 */
export class FlyingModelPlugin extends Plugin<View, ViewContext> {
  private view?: View;
  private config: FlyingModelDefaults &
    Pick<FlyingModelConfig, "modelUrl" | "animation">;

  private handle: MeshHandle | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private modelRef: any = null;
  private animId: number | null = null;
  private lastTime = 0;

  private state: FlyingModelState;
  private listeners = new Set<StateListener>();

  private keys = new Set<string>();
  private dashMultiplier = 1;
  private currentAnimState = "";
  private orbitMode = false;
  private modelYaw: number;
  private cameraYaw: number;

  /** Set to `true` to ignore all movement keys (e.g. while a modal is open). */
  movementSuppressed = false;

  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;

  constructor(config: FlyingModelConfig) {
    super();
    const { modelRotationOffset, modelUrl, animation, ...rest } = config;
    this.config = {
      ...DEFAULTS,
      ...rest,
      modelUrl,
      animation,
      modelRotationOffset: modelRotationOffset
        ? { ...DEFAULT_ROTATION_OFFSET, ...modelRotationOffset }
        : DEFAULT_ROTATION_OFFSET,
    };
    this.modelYaw = this.config.startYaw;
    this.cameraYaw = this.config.startYaw;
    this.currentAnimState = this.config.animation.idleClip;
    this.state = {
      lng: this.config.startLng,
      lat: this.config.startLat,
      alt: this.config.startHeight,
      heading: 0,
      speed: 0,
      animationState: this.config.animation.idleClip,
    };
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
  }

  async init(view: View, _ctx: ViewContext): Promise<void> {
    this.view = view;
  }

  /** Load the GLTF model and start the flight loop. Call after `view.init()`. */
  start(): void {
    if (!this.view) return;

    const { startLat, startLng, startHeight, startYaw, modelScale } =
      this.config;

    const startPos = geodeticToVector3({
      lat: degreeToRadian(startLat),
      lng: degreeToRadian(startLng),
      height: startHeight,
    });

    const { animation, modelRotationOffset } = this.config;

    this.handle = this.view.addMesh({
      gltfModel: {
        url: this.config.modelUrl,
        animationEnabled: true,
        animationAutoPlay: true,
        animationActiveClip: animation.idleClip,
        animationSpeed: animation.speed,
        animationLoop: true,
        animationCrossfadeDuration: animation.crossfadeDuration,
      },
      matrixWorld: eastNorthUpToFixedFrame(startPos),
      rotation: {
        x: modelRotationOffset.x,
        y: modelRotationOffset.y + startYaw,
        z: modelRotationOffset.z,
      },
      scale: { x: modelScale, y: modelScale, z: modelScale },
    });

    this.modelYaw = startYaw;
    this.cameraYaw = startYaw;
    const offsetEast = -Math.sin(startYaw) * this.config.cameraDistance;
    const offsetNorth = -Math.cos(startYaw) * this.config.cameraDistance;
    this.view.lookAt(
      { lat: startLat, lng: startLng, height: startHeight + 1 },
      new Vector3(offsetEast, offsetNorth, this.config.cameraHeight),
    );

    this.modelRef = this.handle.ref;
    this.modelRef.on("load", () => {
      this.lastTime = performance.now();
      this.animId = requestAnimationFrame(this.tick);
    });

    document.addEventListener("keydown", this.boundKeyDown);
    document.addEventListener("keyup", this.boundKeyUp);
  }

  /**
   * Instantly move the model to a new geographic position.
   * @param heading - Optional heading in degrees. If omitted, the current camera yaw is kept.
   */
  teleport(lng: number, lat: number, alt: number, heading?: number): void {
    if (!this.view || !this.handle) return;

    const yaw = heading != null ? degreeToRadian(heading) : this.cameraYaw;

    const pos = geodeticToVector3({
      lat: degreeToRadian(lat),
      lng: degreeToRadian(lng),
      height: alt,
    });

    const { modelRotationOffset } = this.config;
    this.handle.update({
      matrixWorld: eastNorthUpToFixedFrame(pos),
      rotation: {
        x: modelRotationOffset.x,
        y: modelRotationOffset.y + yaw,
        z: modelRotationOffset.z,
      },
    });

    this.modelYaw = yaw;
    this.cameraYaw = yaw;
    const offsetEast = -Math.sin(yaw) * this.config.cameraDistance;
    const offsetNorth = -Math.cos(yaw) * this.config.cameraDistance;
    this.view.lookAt(
      { lat, lng, height: alt + 1 },
      new Vector3(offsetEast, offsetNorth, this.config.cameraHeight),
    );

    this.state = {
      lng,
      lat,
      alt,
      heading: radianToDegree(yaw),
      speed: 0,
      animationState: this.currentAnimState,
    };
    this.notify();
  }

  getState(): FlyingModelState {
    return this.state;
  }

  onStateChange(fn: StateListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  dispose(): void {
    if (this.animId != null) cancelAnimationFrame(this.animId);
    this.animId = null;

    document.removeEventListener("keydown", this.boundKeyDown);
    document.removeEventListener("keyup", this.boundKeyUp);

    if (this.handle) {
      this.handle.delete();
      this.handle = null;
    }
    this.modelRef = null;
    this.keys.clear();
    this.listeners.clear();
    this.orbitMode = false;
  }

  private notify(): void {
    for (const fn of this.listeners) fn(this.state);
  }

  private onKeyDown(e: KeyboardEvent): void {
    const t = e.target as HTMLElement;
    if (
      t.tagName === "INPUT" ||
      t.tagName === "TEXTAREA" ||
      t.isContentEditable
    )
      return;

    if (this.movementSuppressed) return;

    switch (e.code) {
      case "KeyW":
        this.keys.add("forward");
        break;
      case "KeyS":
        this.keys.add("backward");
        break;
      case "KeyA":
        this.keys.add("left");
        break;
      case "KeyD":
        this.keys.add("right");
        break;
      case "ArrowUp":
        this.keys.add("up");
        break;
      case "ArrowDown":
        this.keys.add("down");
        break;
      case "ShiftLeft":
      case "ShiftRight":
        this.dashMultiplier = 2.5;
        break;
      case "AltLeft":
      case "AltRight":
        this.orbitMode = true;
        break;
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    switch (e.code) {
      case "KeyW":
        this.keys.delete("forward");
        break;
      case "KeyS":
        this.keys.delete("backward");
        break;
      case "KeyA":
        this.keys.delete("left");
        break;
      case "KeyD":
        this.keys.delete("right");
        break;
      case "ArrowUp":
        this.keys.delete("up");
        break;
      case "ArrowDown":
        this.keys.delete("down");
        break;
      case "ShiftLeft":
      case "ShiftRight":
        this.dashMultiplier = 1;
        break;
      case "AltLeft":
      case "AltRight":
        this.orbitMode = false;
        break;
    }
  }

  private tick = (currentTime: number): void => {
    if (!this.view || !this.handle || !this.modelRef) return;
    this.animId = requestAnimationFrame(this.tick);

    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    const curPos: Vector3 | undefined = this.modelRef.getWorldPosition();
    if (!curPos) return;

    const {
      flightSpeed,
      rotationSpeed,
      altSpeed,
      minAlt,
      maxAlt,
      cameraDistance,
      cameraHeight,
      cameraLerpSpeed,
    } = this.config;

    let dirX = 0,
      dirY = 0,
      dirZ = 0;
    if (this.keys.has("forward")) dirY += 1;
    if (this.keys.has("backward")) dirY -= 1;
    if (this.keys.has("left")) dirX -= 1;
    if (this.keys.has("right")) dirX += 1;
    if (this.keys.has("up")) dirZ += 1;
    if (this.keys.has("down")) dirZ -= 1;

    const enuMatrix: Matrix4 = eastNorthUpToFixedFrame(curPos);
    const east = new Vector3().setFromMatrixColumn(enuMatrix, 0).normalize();
    const north = new Vector3().setFromMatrixColumn(enuMatrix, 1).normalize();

    const currentLLE = vector3ToGeodetic(curPos);

    if (dirX !== 0) {
      this.modelYaw += degreeToRadian(rotationSpeed * dirX);
    }

    const worldForward = east
      .clone()
      .multiplyScalar(Math.sin(this.modelYaw))
      .add(north.clone().multiplyScalar(Math.cos(this.modelYaw)));

    if (dirY !== 0) {
      curPos.addScaledVector(
        worldForward,
        flightSpeed * this.dashMultiplier * deltaTime * dirY,
      );
    }

    const curLLE = vector3ToGeodetic(curPos);
    let height = currentLLE.height + dirZ * altSpeed * deltaTime;
    height = Math.max(minAlt, Math.min(maxAlt, height));

    const finalPos = geodeticToVector3({
      lat: curLLE.lat,
      lng: curLLE.lng,
      height,
    });

    const { modelRotationOffset, animation } = this.config;
    this.handle.update({
      matrixWorld: eastNorthUpToFixedFrame(finalPos),
      rotation: {
        x: modelRotationOffset.x,
        y: modelRotationOffset.y + this.modelYaw,
        z: modelRotationOffset.z,
      },
    });

    const modelLatDeg = radianToDegree(curLLE.lat);
    const modelLngDeg = radianToDegree(curLLE.lng);

    this.view.cameraFollow(true, {
      lat: modelLatDeg,
      lng: modelLngDeg,
      height: height + 1,
    });

    if (!this.orbitMode) {
      let yawDiff = this.modelYaw - this.cameraYaw;
      yawDiff = yawDiff - Math.round(yawDiff / (Math.PI * 2)) * (Math.PI * 2);
      this.cameraYaw += yawDiff * Math.min(deltaTime * cameraLerpSpeed, 1);

      const offsetEast = -Math.sin(this.cameraYaw) * cameraDistance;
      const offsetNorth = -Math.cos(this.cameraYaw) * cameraDistance;

      this.view.lookAt(
        { lat: modelLatDeg, lng: modelLngDeg, height: height + 1 },
        new Vector3(offsetEast, offsetNorth, cameraHeight),
      );
    }

    const isMoving = dirY !== 0 || dirX !== 0 || dirZ !== 0;
    const isDashing = isMoving && this.dashMultiplier > 1;
    const targetAnim = isDashing ? animation.dashClip : animation.idleClip;
    if (targetAnim !== this.currentAnimState) {
      this.modelRef.crossFadeAnimation(
        this.currentAnimState,
        targetAnim,
        animation.crossfadeDuration,
      );
      this.currentAnimState = targetAnim;
    }

    this.state = {
      lng: modelLngDeg,
      lat: modelLatDeg,
      alt: height,
      heading: radianToDegree(this.modelYaw),
      speed: isMoving ? flightSpeed * this.dashMultiplier : 0,
      animationState: targetAnim,
    };
    this.notify();
  };
}
