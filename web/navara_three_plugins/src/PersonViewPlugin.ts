/**
 * PersonViewPlugin — Navara Plugin for first/third-person view control.
 *
 * Provides keyboard-driven character movement with a chase (TPV) or
 * first-person (FPV) camera. The character (GLTF model) is optional —
 * when omitted, the plugin still drives a virtual position and the
 * camera follows it, so callers can use it purely as a person-view
 * camera controller.
 *
 * ## Usage
 *
 * ```ts
 * import ThreeView from "@navaramap/three";
 * import { DefaultPlugin } from "@navaramap/three_default_plugin";
 * import { PersonViewPlugin } from "@navaramap/three_plugins";
 *
 * const view = new ThreeView({ container, animation: true });
 * const defaultPlugin = new DefaultPlugin();
 * const personView = new PersonViewPlugin({
 *   character: {
 *     modelUrl: "/glTF/my_model/scene.gltf",
 *     animation: {
 *       idleClip: "Idle",
 *       dashClip: "Run",
 *       speed: 1.0,
 *       crossfadeDuration: 0.3,
 *     },
 *     modelRotationOffset: { x: 0, y: 0, z: 0 },
 *   },
 *   allowCameraControl: false,
 *   startLat: 35.6812,
 *   startLng: 139.7671,
 *   startHeight: 500,
 * });
 *
 * view.addPlugin(defaultPlugin);
 * view.addPlugin(personView);
 * await view.init();
 *
 * personView.start();
 *
 * const unsub = personView.onStateChange((state) => {
 *   console.log(state.lat, state.lng, state.alt, state.mode);
 * });
 *
 * personView.teleport({ lng, lat, alt, heading: headingRad });
 * personView.toggleViewMode();
 *
 * unsub();
 * personView.dispose();
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
} from "@navaramap/three";
import type { GLTFModelDesc } from "@navaramap/three_default_descs";
import type { DefaultDescriptions } from "@navaramap/three_default_plugin";
import { Vector3, Matrix4 } from "three";

type View = ThreeView<DefaultDescriptions>;

export type ViewMode = "tpv" | "fpv";

export type PersonViewState = {
  lng: number;
  lat: number;
  alt: number;
  /** Heading in radians — 0 = north, increasing clockwise. */
  heading: number;
  speed: number;
  /** Current animation clip name, or null when no character is configured. */
  animationState: string | null;
  mode: ViewMode;
};

/** Options for {@link PersonViewPlugin.teleport}. */
export type TeleportOptions = {
  /** Longitude in degrees. */
  lng: number;
  /** Latitude in degrees. */
  lat: number;
  /** Altitude in meters. */
  alt: number;
  /**
   * Heading in radians (0 = north, increasing clockwise). If omitted, the
   * current camera heading is kept. (Use `setHeading` to rotate in place
   * without moving, and `setCameraPitch` / `setFpvPitch` for camera pitch.)
   */
  heading?: number;
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
  /** Clip name played while the model is idle (no movement keys held). */
  idleClip: string;
  /**
   * Clip name played while the model is moving without dashing.
   * Omit to keep `idleClip` playing while walking — useful for models
   * that only ship with idle + dash animations.
   */
  walkClip?: string;
  /** Clip name played while the model is dashing (dash key held). */
  dashClip: string;
  /** Playback speed multiplier. */
  speed: number;
  /** Duration in seconds for cross-fade transitions between clips. */
  crossfadeDuration: number;
};

export type CharacterConfig = {
  /** URL of the GLTF model to load. */
  modelUrl: string;
  /** Animation clip configuration. */
  animation: AnimationConfig;
  /** Rotation offset to correct the model's default orientation. */
  modelRotationOffset?: ModelRotationOffset;
  modelScale?: number;
  /** Hide the model while the camera is in FPV. Defaults to true. */
  hideModelInFpv?: boolean;
  /** Whether the character casts shadows. Defaults to false. */
  castShadow?: boolean;
  /** Whether the character receives shadows. Defaults to false. */
  receiveShadow?: boolean;
};

/**
 * Keyboard bindings. Each entry takes an array of `KeyboardEvent.code`
 * values (e.g. `["KeyW"]`, `["ArrowUp", "ControlLeft"]`) so multiple
 * keys can trigger the same action.
 */
export type KeyBindings = {
  forward?: string[];
  backward?: string[];
  turnLeft?: string[];
  turnRight?: string[];
  ascend?: string[];
  descend?: string[];
  dash?: string[];
  /** Hold to enable free camera (orbit) while allowCameraControl is false. */
  orbitCamera?: string[];
  /** Toggle between TPV and FPV. */
  toggleView?: string[];
};

type Action =
  | "forward"
  | "backward"
  | "turnLeft"
  | "turnRight"
  | "ascend"
  | "descend"
  | "dash"
  | "orbitCamera"
  | "toggleView";

export type PersonViewConfig = {
  character?: CharacterConfig;

  /** When true, the camera is always free (no Alt-hold required). */
  allowCameraControl?: boolean;
  /** Initial view mode. */
  initialView?: ViewMode;

  /** m/s */
  moveSpeed?: number;
  /** deg/frame */
  rotationSpeed?: number;
  /** m/s */
  altSpeed?: number;
  minAlt?: number;
  maxAlt?: number;
  cameraDistance?: number;
  /**
   * Downward camera pitch in radians for **TPV**. `0` keeps the camera
   * behind the model at eye level; positive values orbit the camera up and
   * over so it looks down at the model while keeping it centered. Has no
   * effect while the free camera is active (Alt-hold or `allowCameraControl`),
   * where mouse drag controls the pitch instead.
   */
  cameraPitch?: number;
  cameraLerpSpeed?: number;
  /** Forward offset (meters) applied to the FPV eye position. */
  fpvForwardOffset?: number;
  /**
   * Eye-line height offset (meters) added to the position. Used in FPV for the
   * eye position and in TPV as the shared eye-line height the camera orbits
   * around and aims at.
   */
  fpvHeightOffset?: number;
  /**
   * Downward camera pitch in radians for **FPV**. `0` looks straight ahead
   * (horizontal); positive values tilt the view down in place without moving
   * the eye. Has no effect while the free camera is active.
   */
  fpvPitch?: number;

  startLat?: number;
  startLng?: number;
  startHeight?: number;
  /** radians */
  startHeading?: number;

  keys?: KeyBindings;
};

type StateListener = (s: PersonViewState) => void;

const DEFAULT_ROTATION_OFFSET: ModelRotationOffset = {
  x: 0,
  y: 0,
  z: 0,
};

const DEFAULT_KEYS: Required<KeyBindings> = {
  forward: ["KeyW"],
  backward: ["KeyS"],
  turnLeft: ["KeyA"],
  turnRight: ["KeyD"],
  ascend: ["ArrowUp", "Space"],
  descend: ["ArrowDown", "ControlLeft", "ControlRight"],
  dash: ["ShiftLeft", "ShiftRight"],
  orbitCamera: ["AltLeft", "AltRight"],
  toggleView: ["KeyV"],
};

type PersonViewDefaults = Required<
  Omit<PersonViewConfig, "character" | "keys">
>;

const DEFAULTS: PersonViewDefaults = {
  allowCameraControl: false,
  initialView: "tpv",
  moveSpeed: 50,
  rotationSpeed: 3,
  altSpeed: 30,
  minAlt: 50,
  maxAlt: 5000,
  cameraDistance: 50,
  cameraPitch: 0,
  cameraLerpSpeed: 3,
  fpvForwardOffset: 0,
  fpvHeightOffset: 1,
  fpvPitch: 0,
  startLat: 35.6812,
  startLng: 139.7671,
  startHeight: 500,
  startHeading: Math.PI * 1.3,
};

const DEFAULT_MODEL_SCALE = 3;

/** Distance (meters) from the FPV eye to the look-at target. */
const FPV_LOOK_AHEAD_DISTANCE = 1000;

type ResolvedCharacter = Required<
  Pick<
    CharacterConfig,
    | "modelUrl"
    | "animation"
    | "modelScale"
    | "hideModelInFpv"
    | "castShadow"
    | "receiveShadow"
  >
> & {
  modelRotationOffset: ModelRotationOffset;
};

/**
 * Register via `view.addPlugin(plugin)` **before** `view.init()`,
 * then call `start()` after initialization completes.
 *
 * ### Default controls
 *
 * | Key | Action |
 * |-----|--------|
 * | W / S | Forward / backward |
 * | A / D | Turn left / right |
 * | Arrow Up / Space | Climb |
 * | Arrow Down / Ctrl | Descend |
 * | Shift | Dash (2.5x speed) |
 * | Alt | Free camera (when allowCameraControl is false) |
 * | V | Toggle TPV / FPV |
 */
export class PersonViewPlugin extends Plugin<View, ViewContext> {
  private view?: View;
  private config: PersonViewDefaults;
  private character: ResolvedCharacter | null;
  private keys: Required<KeyBindings>;
  private keyToAction: Map<string, Action>;

  private handle: MeshHandle<GLTFModelDesc> | null = null;
  private modelRef: GLTFModelDesc | null = null;
  private animId: number | null = null;
  private lastTime = 0;

  private state!: PersonViewState;
  private listeners = new Set<StateListener>();

  private heldActions = new Set<Action>();
  private dashMultiplier = 1;
  private orbitKeyHeld = false;
  // Persists the free-camera state after Alt release until the user
  // initiates a new movement action. Lets users dwell at an orbited
  // angle instead of snapping back the moment Alt is released.
  private orbitLatched = false;
  private currentAnimState: string | null;
  private modelHeading: number;
  private cameraHeading: number;
  private viewMode: ViewMode;

  /** Set to `true` to ignore all movement keys (e.g. while a modal is open). */
  movementSuppressed = false;

  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;

  // Per-tick scratch buffers reused across frames to keep the hot path
  // allocation-free. Safe because each value is consumed before the next
  // overwrite within a single tick, and `handle.update({matrixWorld})`
  // reads the matrix synchronously (RTE conversion runs inside the
  // update call), so the descriptor never observes a stale reference.
  private _curPos = new Vector3();
  private _east = new Vector3();
  private _north = new Vector3();
  private _worldForward = new Vector3();
  private _offset = new Vector3();
  private _headingMatrix = new Matrix4();
  private _characterFrame = new Matrix4();

  constructor(config: PersonViewConfig = {}) {
    super();
    const { character, keys, ...rest } = config;
    this.config = { ...DEFAULTS, ...rest };
    this.character = character ? this.resolveCharacter(character) : null;
    this.keys = { ...DEFAULT_KEYS, ...keys };
    this.keyToAction = this.buildKeyMap(this.keys);

    this.modelHeading = this.config.startHeading;
    this.cameraHeading = this.config.startHeading;
    this.viewMode = this.config.initialView;
    this.currentAnimState = this.character
      ? this.character.animation.idleClip
      : null;
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
  }

  async init(view: View, _ctx: ViewContext): Promise<void> {
    this.view = view;
    this.state = {
      lng: this.config.startLng,
      lat: this.config.startLat,
      alt: this.config.startHeight,
      heading: this.config.startHeading,
      speed: 0,
      animationState: this.currentAnimState,
      mode: this.viewMode,
    };
  }

  start(): void {
    if (!this.view) return;
    if (this.animId != null) return;
    this.animId = -1;

    const { startLat, startLng, startHeight, startHeading } = this.config;
    const startPos = geodeticToVector3({
      lat: degreeToRadian(startLat),
      lng: degreeToRadian(startLng),
      height: startHeight,
    });

    this.modelHeading = startHeading;
    this.cameraHeading = startHeading;

    if (this.character) {
      const {
        animation,
        modelRotationOffset,
        modelScale,
        castShadow,
        receiveShadow,
      } = this.character;
      this.handle = this.view.addMesh({
        gltfModel: {
          url: this.character.modelUrl,
          castShadow,
          receiveShadow,
          animationEnabled: true,
          animationAutoPlay: true,
          animationActiveClip: animation.idleClip,
          animationSpeed: animation.speed,
          animationLoop: true,
          animationCrossfadeDuration: animation.crossfadeDuration,
        },
        matrixWorld: this.composeCharacterFrame(startPos, startHeading),
        rotation: {
          x: modelRotationOffset.x,
          y: modelRotationOffset.y,
          z: modelRotationOffset.z,
        },
        scale: { x: modelScale, y: modelScale, z: modelScale },
      });

      this.modelRef = this.handle.ref;
      this.modelRef.on("load", () => {
        if (!this.view) return;
        this.lastTime = performance.now();
        this.animId = requestAnimationFrame(this.tick);
      });
    } else {
      this.lastTime = performance.now();
      this.animId = requestAnimationFrame(this.tick);
    }

    this.applyInitialCamera();
    this.applyModelVisibility();

    document.addEventListener("keydown", this.boundKeyDown);
    document.addEventListener("keyup", this.boundKeyUp);
  }

  /** Instantly move to a new geographic position. */
  teleport(options: TeleportOptions): void {
    if (!this.view) return;

    const { lng, lat, alt } = options;
    const headingRad =
      options.heading != null ? options.heading : this.cameraHeading;

    if (this.handle && this.character) {
      const pos = geodeticToVector3({
        lat: degreeToRadian(lat),
        lng: degreeToRadian(lng),
        height: alt,
      });
      this.handle.update({
        matrixWorld: this.composeCharacterFrame(pos, headingRad),
      });
    }

    this.modelHeading = headingRad;
    this.cameraHeading = headingRad;
    this.placeChaseCamera(lat, lng, alt, headingRad);

    this.state = {
      lng,
      lat,
      alt,
      heading: headingRad,
      speed: 0,
      animationState: this.currentAnimState,
      mode: this.viewMode,
    };
    this.notify();
  }

  getState(): PersonViewState {
    return this.state;
  }

  onStateChange(fn: StateListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  setViewMode(mode: ViewMode): void {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    this.state = { ...this.state, mode };
    this.applyModelVisibility();
    // Snap the camera to the new mode's geometry. Without this, when
    // allowCameraControl is true the per-frame loop calls
    // cameraFollow(target) with no offset and the camera lingers at
    // wherever it was — e.g. switching back from FPV to TPV would keep
    // the FPV eye position instead of restoring the chase distance.
    this.placeChaseCamera(
      this.state.lat,
      this.state.lng,
      this.state.alt,
      this.cameraHeading,
    );
    this.notify();
  }

  toggleViewMode(): void {
    this.setViewMode(this.viewMode === "tpv" ? "fpv" : "tpv");
  }

  setAllowCameraControl(value: boolean): void {
    this.config.allowCameraControl = value;
  }

  /**
   * Rotate the character to the given heading in radians (0 = north,
   * increasing clockwise) without changing position. Snaps the chase camera to
   * match; in free-camera mode only the model rotates.
   */
  setHeading(radians: number): void {
    if (!this.view) return;

    const { lat, lng, alt } = this.state;
    this.modelHeading = radians;
    this.cameraHeading = radians;

    if (this.handle && this.character) {
      const pos = geodeticToVector3({
        lat: degreeToRadian(lat),
        lng: degreeToRadian(lng),
        height: alt,
      });
      this.handle.update({
        matrixWorld: this.composeCharacterFrame(pos, radians),
      });
    }

    if (!this.isFreeCamera()) {
      this.placeChaseCamera(lat, lng, alt, radians);
    }

    this.state = { ...this.state, heading: radians };
    this.notify();
  }

  /** Current character heading in radians. */
  getHeading(): number {
    return this.state.heading;
  }

  /**
   * Set the downward TPV camera pitch in radians (0 = behind at eye level,
   * positive orbits up and over the model). Takes effect immediately for the
   * chase / locked camera.
   */
  setCameraPitch(radians: number): void {
    this.config.cameraPitch = radians;
    if (!this.isFreeCamera()) {
      this.placeChaseCamera(
        this.state.lat,
        this.state.lng,
        this.state.alt,
        this.cameraHeading,
      );
    }
  }

  /** Current downward TPV camera pitch in radians. */
  getCameraPitch(): number {
    return this.config.cameraPitch;
  }

  /**
   * Set the downward FPV camera pitch in radians (0 = horizontal, positive
   * tilts the view down in place). Takes effect immediately for the chase /
   * locked camera.
   */
  setFpvPitch(radians: number): void {
    this.config.fpvPitch = radians;
    if (!this.isFreeCamera()) {
      this.placeChaseCamera(
        this.state.lat,
        this.state.lng,
        this.state.alt,
        this.cameraHeading,
      );
    }
  }

  /** Current downward FPV camera pitch in radians. */
  getFpvPitch(): number {
    return this.config.fpvPitch;
  }

  /**
   * Set the FPV eye height offset in meters (added to the position to get the
   * eye height). Also used as the shared eye-line height in TPV. Takes effect
   * immediately for the chase / locked camera.
   */
  setFpvHeightOffset(meters: number): void {
    this.config.fpvHeightOffset = meters;
    if (!this.isFreeCamera()) {
      this.placeChaseCamera(
        this.state.lat,
        this.state.lng,
        this.state.alt,
        this.cameraHeading,
      );
    }
  }

  /** Current FPV eye height offset in meters. */
  getFpvHeightOffset(): number {
    return this.config.fpvHeightOffset;
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
    this.heldActions.clear();
    this.listeners.clear();
    this.orbitKeyHeld = false;
    this.orbitLatched = false;
    this.dashMultiplier = 1;
    this.view = undefined;
  }
  private resolveCharacter(c: CharacterConfig): ResolvedCharacter {
    return {
      modelUrl: c.modelUrl,
      animation: c.animation,
      modelRotationOffset: c.modelRotationOffset
        ? { ...DEFAULT_ROTATION_OFFSET, ...c.modelRotationOffset }
        : DEFAULT_ROTATION_OFFSET,
      modelScale: c.modelScale ?? DEFAULT_MODEL_SCALE,
      hideModelInFpv: c.hideModelInFpv ?? true,
      castShadow: c.castShadow ?? false,
      receiveShadow: c.receiveShadow ?? false,
    };
  }

  private buildKeyMap(keys: Required<KeyBindings>): Map<string, Action> {
    const m = new Map<string, Action>();
    const bind = (codes: string[], action: Action) => {
      for (const code of codes) m.set(code, action);
    };
    bind(keys.forward, "forward");
    bind(keys.backward, "backward");
    bind(keys.turnLeft, "turnLeft");
    bind(keys.turnRight, "turnRight");
    bind(keys.ascend, "ascend");
    bind(keys.descend, "descend");
    bind(keys.dash, "dash");
    bind(keys.orbitCamera, "orbitCamera");
    bind(keys.toggleView, "toggleView");
    return m;
  }

  private isFreeCamera(): boolean {
    return (
      this.config.allowCameraControl || this.orbitKeyHeld || this.orbitLatched
    );
  }

  private isMovementAction(action: Action): boolean {
    return (
      action === "forward" ||
      action === "backward" ||
      action === "turnLeft" ||
      action === "turnRight" ||
      action === "ascend" ||
      action === "descend"
    );
  }

  private applyModelVisibility(): void {
    if (!this.handle || !this.character) return;
    const shouldHide = this.viewMode === "fpv" && this.character.hideModelInFpv;
    this.handle.visible = !shouldHide;
  }

  private applyInitialCamera(): void {
    const { startLat, startLng, startHeight, startHeading } = this.config;
    this.placeChaseCamera(startLat, startLng, startHeight, startHeading);
  }

  /**
   * Chase / locked camera placement. Caller supplies the heading (radians)
   * to use — lerped during the per-frame loop, snapped on teleport / init.
   *
   * Pitch is per-mode: FPV uses `fpvPitch` and tilts the view down in place
   * (the eye stays fixed); TPV uses `cameraPitch` and orbits the camera around
   * the model, staying aimed at it so the model remains centered.
   */
  private placeChaseCamera(
    lat: number,
    lng: number,
    alt: number,
    heading: number,
  ): void {
    if (!this.view) return;

    const {
      cameraDistance,
      cameraPitch,
      fpvPitch,
      fpvHeightOffset,
      fpvForwardOffset,
    } = this.config;
    const isFpv = this.viewMode === "fpv";
    const eyeHeight = alt + fpvHeightOffset;

    if (isFpv) {
      // FPV: the eye is locked to the person's position at eye height.
      // `fpvPitch` tilts the view down *in place* by lowering the look-at
      // target while a matching upward offset keeps the eye itself at
      // `eyeHeight` — only the look direction changes, not the position.
      //
      // The target sits far ahead and the camera is offset back by the
      // same distance, so the camera ends up at the eye looking forward.
      const backDistance = FPV_LOOK_AHEAD_DISTANCE;
      const lookAheadDistance = fpvForwardOffset + FPV_LOOK_AHEAD_DISTANCE;
      const targetDrop = Math.tan(fpvPitch) * backDistance;
      const target = this.advanceLatLng(lat, lng, heading, lookAheadDistance);

      this._offset.set(
        -Math.sin(heading) * backDistance,
        -Math.cos(heading) * backDistance,
        targetDrop,
      );

      this.view.cameraFollow(
        true,
        { lat: target.lat, lng: target.lng, height: eyeHeight - targetDrop },
        this._offset,
      );
      return;
    }

    // TPV: orbit the camera around the model. The look-at target stays on
    // the model at eye height, and `cameraPitch` raises the camera while
    // keeping it aimed at the model, so the model stays centered as you tilt
    // down. The eye orbits at constant `cameraDistance` from the model:
    // pulled back by `cos(pitch)` horizontally and up by `sin(pitch)`.
    const horizontal = cameraDistance * Math.cos(cameraPitch);
    const vertical = cameraDistance * Math.sin(cameraPitch);

    this._offset.set(
      -Math.sin(heading) * horizontal,
      -Math.cos(heading) * horizontal,
      vertical,
    );

    this.view.cameraFollow(true, { lat, lng, height: eyeHeight }, this._offset);
  }

  /**
   * Compose the character's world matrix as `ENU * Rz(-heading)`.
   *
   * The ENU frame already places the model at the right spot on the
   * globe with +Z pointing world-up. Multiplying by a Z-rotation of
   * `-heading` (negated because three.js Rz is counter-clockwise when
   * viewed from +Z, while our heading convention is clockwise from
   * north) bakes the heading into the world matrix.
   *
   * The character's `rotation` field is therefore left as the static
   * `modelRotationOffset` only — its job is to position the model in
   * its "facing-north, upright" rest pose. Heading then rotates the
   * already-upright model around world-up, regardless of which axis
   * the GLTF treats as forward.
   */
  private composeCharacterFrame(pos: Vector3, heading: number): Matrix4 {
    const enuFrame = eastNorthUpToFixedFrame(pos);
    this._headingMatrix.makeRotationZ(-heading);
    return this._characterFrame.multiplyMatrices(enuFrame, this._headingMatrix);
  }

  /** Advance a (lat,lng) point by `meters` along the given ENU heading. */
  private advanceLatLng(
    lat: number,
    lng: number,
    heading: number,
    meters: number,
  ): { lat: number; lng: number } {
    const pos = geodeticToVector3({
      lat: degreeToRadian(lat),
      lng: degreeToRadian(lng),
      height: 0,
    });
    const enu: Matrix4 = eastNorthUpToFixedFrame(pos);
    this._east.setFromMatrixColumn(enu, 0).normalize();
    this._north.setFromMatrixColumn(enu, 1).normalize();
    this._worldForward
      .copy(this._east)
      .multiplyScalar(Math.sin(heading))
      .addScaledVector(this._north, Math.cos(heading));
    pos.addScaledVector(this._worldForward, meters);
    const lle = vector3ToGeodetic(pos);
    return { lat: radianToDegree(lle.lat), lng: radianToDegree(lle.lng) };
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

    const action = this.keyToAction.get(e.code);
    if (action === undefined) return;

    if (action === "toggleView") {
      if (e.repeat) return;
      this.toggleViewMode();
      return;
    }
    if (action === "orbitCamera") {
      this.orbitKeyHeld = true;
      this.orbitLatched = true;
      return;
    }

    if (this.movementSuppressed) return;

    if (action === "dash") {
      this.dashMultiplier = 2.5;
      return;
    }
    if (this.isMovementAction(action)) {
      // A new movement keypress releases the latched orbit so the camera
      // snaps back to chase on the next tick.
      this.orbitLatched = false;
    }
    this.heldActions.add(action);
  }

  private onKeyUp(e: KeyboardEvent): void {
    const action = this.keyToAction.get(e.code);
    if (action === undefined) return;

    if (action === "toggleView") return;
    if (action === "orbitCamera") {
      this.orbitKeyHeld = false;
      return;
    }
    if (action === "dash") {
      this.dashMultiplier = 1;
      return;
    }
    this.heldActions.delete(action);
  }

  private tick = (currentTime: number): void => {
    if (!this.view) return;
    this.animId = requestAnimationFrame(this.tick);

    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    let dirX = 0,
      dirY = 0,
      dirZ = 0;
    if (this.heldActions.has("forward")) dirY += 1;
    if (this.heldActions.has("backward")) dirY -= 1;
    if (this.heldActions.has("turnLeft")) dirX -= 1;
    if (this.heldActions.has("turnRight")) dirX += 1;
    if (this.heldActions.has("ascend")) dirZ += 1;
    if (this.heldActions.has("descend")) dirZ -= 1;

    const {
      moveSpeed,
      rotationSpeed,
      altSpeed,
      minAlt,
      maxAlt,
      cameraLerpSpeed,
    } = this.config;

    if (dirX !== 0) {
      this.modelHeading += degreeToRadian(rotationSpeed * dirX);
    }

    const curPos = this._curPos;

    if (this.handle && this.modelRef) {
      const refPos: Vector3 | undefined = this.modelRef.getWorldPosition();
      if (!refPos) return;
      curPos.copy(refPos);
    } else {
      curPos.copy(
        geodeticToVector3({
          lat: degreeToRadian(this.state.lat),
          lng: degreeToRadian(this.state.lng),
          height: this.state.alt,
        }),
      );
    }

    const enuMatrix: Matrix4 = eastNorthUpToFixedFrame(curPos);
    this._east.setFromMatrixColumn(enuMatrix, 0).normalize();
    this._north.setFromMatrixColumn(enuMatrix, 1).normalize();
    const currentLLE = vector3ToGeodetic(curPos);

    this._worldForward
      .copy(this._east)
      .multiplyScalar(Math.sin(this.modelHeading))
      .addScaledVector(this._north, Math.cos(this.modelHeading));

    if (dirY !== 0) {
      curPos.addScaledVector(
        this._worldForward,
        moveSpeed * this.dashMultiplier * deltaTime * dirY,
      );
    }

    const advancedLLE = vector3ToGeodetic(curPos);
    const rawHeight = currentLLE.height + dirZ * altSpeed * deltaTime;
    const height = Math.max(minAlt, Math.min(maxAlt, rawHeight));
    const nextLat = radianToDegree(advancedLLE.lat);
    const nextLng = radianToDegree(advancedLLE.lng);
    const nextAlt = height;

    if (this.handle && this.character) {
      const finalPos = geodeticToVector3({
        lat: advancedLLE.lat,
        lng: advancedLLE.lng,
        height,
      });
      this.handle.update({
        matrixWorld: this.composeCharacterFrame(finalPos, this.modelHeading),
      });
    }

    // Lerp camera heading toward the model heading — shared between TPV and FPV
    // so turning feels identical in both modes.
    let headingDiff = this.modelHeading - this.cameraHeading;
    headingDiff =
      headingDiff - Math.round(headingDiff / (Math.PI * 2)) * (Math.PI * 2);
    this.cameraHeading +=
      headingDiff * Math.min(deltaTime * cameraLerpSpeed, 1);

    if (this.isFreeCamera()) {
      if (this.viewMode === "fpv") {
        // FPV: position-locked free-look at eye height. The Rust side
        // pins the camera to the target and lets mouse drag rotate
        // orientation only — no orbit-around-target motion.
        //
        // Advance the eye by `fpvForwardOffset` so it matches the eye
        // position produced by `placeChaseCamera` (which lands the
        // camera that far ahead of the position). Without this the eye
        // sits exactly on the position, so engaging free-look snaps the
        // camera back by `fpvForwardOffset` from the chase placement.
        const eye = this.advanceLatLng(
          nextLat,
          nextLng,
          this.cameraHeading,
          this.config.fpvForwardOffset,
        );
        this.view.cameraFreeLook(true, {
          lat: eye.lat,
          lng: eye.lng,
          height: nextAlt + this.config.fpvHeightOffset,
        });
      } else {
        // Keep the orbit pivot at the same eye height used everywhere
        // else so switching between free and chase camera is seamless.
        this.view.cameraFollow(true, {
          lat: nextLat,
          lng: nextLng,
          height: nextAlt + this.config.fpvHeightOffset,
        });
      }
    } else {
      this.placeChaseCamera(nextLat, nextLng, nextAlt, this.cameraHeading);
    }

    const isMoving = dirY !== 0 || dirX !== 0 || dirZ !== 0;
    const isDashing = isMoving && this.dashMultiplier > 1;

    let nextAnimState = this.currentAnimState;
    if (this.character && this.modelRef) {
      const { animation } = this.character;
      const walkClip = animation.walkClip ?? animation.idleClip;
      let targetAnim: string;
      if (isDashing) {
        targetAnim = animation.dashClip;
      } else if (isMoving) {
        targetAnim = walkClip;
      } else {
        targetAnim = animation.idleClip;
      }
      if (targetAnim !== this.currentAnimState) {
        this.modelRef.crossFadeAnimation(
          this.currentAnimState ?? "",
          targetAnim,
          animation.crossfadeDuration,
        );
        this.currentAnimState = targetAnim;
      }
      nextAnimState = targetAnim;
    }

    const nextState: PersonViewState = {
      lng: nextLng,
      lat: nextLat,
      alt: nextAlt,
      heading: this.modelHeading,
      speed: moveSpeed * this.dashMultiplier,
      animationState: nextAnimState,
      mode: this.viewMode,
    };
    if (this.hasStateChanged(this.state, nextState)) {
      this.state = nextState;
      this.notify();
    }
  };

  private hasStateChanged(a: PersonViewState, b: PersonViewState): boolean {
    return (
      a.lng !== b.lng ||
      a.lat !== b.lat ||
      a.alt !== b.alt ||
      a.heading !== b.heading ||
      a.speed !== b.speed ||
      a.animationState !== b.animationState ||
      a.mode !== b.mode
    );
  }
}
