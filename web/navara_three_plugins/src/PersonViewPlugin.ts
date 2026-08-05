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
 * import { DefaultPlugin } from "@navaramap/three-default-plugin";
 * import { PersonViewPlugin } from "@navaramap/three-plugins";
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
import type { GLTFModelDesc } from "@navaramap/three-default-descs";
import type { DefaultDescriptions } from "@navaramap/three-default-plugin";
import { Vector3, Matrix4, MathUtils } from "three";

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
  /** Playback speed for any clip without a per-clip override below. */
  speed?: number;
  /** Playback speed for the idle clip (falls back to {@link speed}). */
  idleSpeed?: number;
  /** Playback speed for the walk clip (falls back to {@link speed}). */
  walkSpeed?: number;
  /** Playback speed for the dash clip (falls back to {@link speed}). */
  dashSpeed?: number;
  /** Duration in seconds for cross-fade transitions between clips. */
  crossfadeDuration: number;
};

/**
 * How the character's altitude reacts to the terrain surface.
 *
 * - `"off"` — altitude is driven purely by the ascend / descend keys.
 * - `"clamp"` — free flight, but the terrain acts as a floor: the character is
 *   pushed up whenever it would end up below the surface.
 * - `"ground"` — the character is glued to the terrain surface, so it walks up
 *   and down slopes. The ascend / descend keys have no effect in this mode.
 */
export type CollisionMode = "off" | "clamp" | "ground";

/** Terrain collision configuration. See {@link CollisionMode}. */
export type CollisionConfig = {
  /** @defaultValue `"off"` */
  mode?: CollisionMode;
  /**
   * Height (meters) kept above the sampled terrain surface — the character's
   * feet in `"ground"` mode, the floor it cannot sink below in `"clamp"`.
   * @defaultValue `0`
   */
  groundOffset?: number;
  /**
   * Tilt the character to match the slope it stands on. Costs several extra
   * terrain lookups per frame, and fades out as it leaves the ground in
   * `"clamp"` mode.
   * @defaultValue `true`
   */
  alignToSlope?: boolean;
  /**
   * Footprint (meters) the slope under the character is averaged over. The
   * default suits the triangle spacing terrain meshes arrive at; below that
   * there is nothing left to average and the tilt starts to step.
   * @defaultValue `4`
   */
  slopeSampleDistance?: number;
  /**
   * Largest tilt (radians) {@link alignToSlope} may apply, so ground far
   * steeper than anything walkable does not lay the character flat against it.
   * @defaultValue `Math.PI / 4` (45°)
   */
  maxSlopeTilt?: number;
  /**
   * How much of the terrain's slope the camera pitch follows, from `0` (fixed
   * pitch, so a steep hillside fills the frame) to `1` (the view runs parallel
   * to the slope, looking up a climb and down a descent). Applies to the TPV
   * chase camera and the FPV eye line alike.
   * @defaultValue `1`
   */
  cameraSlopeFollow?: number;
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

/**
 * A recognized control input. Delivered to {@link PersonViewPlugin.onAction}
 * listeners on each keypress — e.g. to dismiss an on-screen controls hint once
 * the user starts driving the character.
 */
export type PersonViewAction =
  | "forward"
  | "backward"
  | "turnLeft"
  | "turnRight"
  | "ascend"
  | "descend"
  | "dash"
  | "orbitCamera"
  | "toggleView";

type Action = PersonViewAction;

export type PersonViewConfig = {
  character?: CharacterConfig;
  /**
   * Terrain collision. Off by default — the character flies freely and ignores
   * the terrain surface.
   */
  collision?: CollisionConfig;

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
  /**
   * Factor applied to {@link moveSpeed} while the dash key is held.
   * @defaultValue `2.5`
   */
  dashSpeedMultiplier?: number;
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
type ActionListener = (action: PersonViewAction) => void;

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
  Omit<PersonViewConfig, "character" | "keys" | "collision">
>;

type ResolvedCollision = Required<CollisionConfig>;

/** A geodetic position in radians, as the geodetic helpers return it. */
type LatLngRadians = { lat: number; lng: number };

// Tuned so that `collision: { mode: "ground" }` alone walks terrain well: the
// slope footprint is wide enough for the triangle spacing real terrain meshes
// arrive at.
const DEFAULT_COLLISION: ResolvedCollision = {
  mode: "off",
  groundOffset: 0,
  alignToSlope: true,
  slopeSampleDistance: 4,
  maxSlopeTilt: Math.PI / 4,
  cameraSlopeFollow: 1,
};

/**
 * Terrain tiles keep being replaced by finer ones, which moves the surface and
 * its gradient under a character that has not gone anywhere — by hundreds of
 * meters right after load. These bound how fast that is allowed to reach the
 * character: without them it is thrown up the mountainside and back, and a
 * single frame swings the slope tilt by 13°.
 *
 * The height settles under an acceleration (m/s²) rather than at a fixed speed,
 * because the two cases need opposite things from it. A second of tile churn
 * must barely move the character, which a speed low enough to do that then
 * takes half a minute to walk back a surface that turned out to be 250m out.
 * Falling covers the first in a few meters and the second in a few seconds.
 *
 * They are constants rather than options because there is nothing about an
 * application that makes another value right: ground the character *walks*
 * onto is never bounded by them, so they only ever act on data catching up.
 */
const GROUND_SETTLE_ACCELERATION = 10;
const SLOPE_TILT_SMOOTHING = 6;

/**
 * Largest pitch change {@link CollisionConfig.cameraSlopeFollow} may apply, so
 * a near-vertical face does not swing the view to straight up or down. Framing
 * is tuned with `cameraSlopeFollow`; this is only the guard rail behind it.
 */
const MAX_CAMERA_SLOPE_PITCH = Math.PI / 4;

/**
 * Bearings (radians from north) of the probe ring that measures the terrain
 * gradient for `alignToSlope`. Fitting a ring is steadier than a forward /
 * sideways pair: a probe crossing a mesh edge steps the slope it reports, and
 * the ring keeps any single step from tilting the whole character.
 */
const SLOPE_PROBE_BEARINGS = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
  const bearing = (i * Math.PI) / 4;
  return { sin: Math.sin(bearing), cos: Math.cos(bearing) };
});

/**
 * Fraction of the remaining distance to cover this frame when easing toward a
 * target at `rate` (1/s). Exponential, so it is frame-rate independent and
 * never overshoots. A rate of `0` — or a frame of no length, as when
 * teleporting — snaps, which is why this is not `MathUtils.damp`.
 */
const easeFactor = (rate: number, deltaTime: number): number =>
  rate > 0 && deltaTime > 0 ? 1 - Math.exp(-rate * deltaTime) : 1;

const DEFAULTS: PersonViewDefaults = {
  allowCameraControl: false,
  initialView: "tpv",
  moveSpeed: 50,
  rotationSpeed: 3,
  altSpeed: 30,
  dashSpeedMultiplier: 2.5,
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
  private collision: ResolvedCollision;
  private character: ResolvedCharacter | null;
  private keys: Required<KeyBindings>;
  private keyToAction: Map<string, Action>;

  private handle: MeshHandle<GLTFModelDesc> | null = null;
  private modelRef: GLTFModelDesc | null = null;
  private animId: number | null = null;
  /** Whether the character has been placed, so `start()` resumes from here. */
  private placed = false;
  private lastTime = 0;

  private state!: PersonViewState;
  private listeners = new Set<StateListener>();
  private actionListeners = new Set<ActionListener>();

  private heldActions = new Set<Action>();
  /** Whether the dash key is held. Kept separate from the numeric speed factor
   * so the dash animation still plays when `dashSpeedMultiplier` is 1 (or <1). */
  private dashHeld = false;
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
  private _probePos = new Vector3();
  private _headingMatrix = new Matrix4();
  private _tiltMatrix = new Matrix4();
  private _characterFrame = new Matrix4();

  /** Smoothed pitch (radians) the chase camera gives up to follow the slope. */
  private cameraSlopePitch = 0;

  // Smoothed terrain gradient (meters of rise per meter travelled) under the
  // character, held in ENU so it does not have to be re-smoothed when the
  // character turns. Zero unless `alignToSlope` is on.
  private slopeGradEast = 0;
  private slopeGradNorth = 0;

  /**
   * Terrain height (meters) sampled under the character last frame, with the
   * position it was taken at, so the next frame can re-sample the same spot and
   * tell a change in the terrain data apart from the character having moved.
   */
  private lastGroundSample?: { lat: number; lng: number; height: number };
  /** Meters of terrain data shift not yet passed on to the character. */
  private unabsorbedGroundShift = 0;
  /** Speed (m/s) that shift is being worked off at, positive when rising. */
  private settleVelocity = 0;
  /** Surface height (meters) the character stands on, once settling is applied. */
  private groundSurfaceHeight?: number;

  constructor(config: PersonViewConfig = {}) {
    super();
    const { character, keys, collision, ...rest } = config;
    this.config = { ...DEFAULTS, ...rest };
    this.collision = { ...DEFAULT_COLLISION, ...collision };
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

  /**
   * Take over the camera and start reading the movement keys. Calling it again
   * after {@link stop} resumes from wherever the character was left, rather
   * than starting over at the configured position.
   */
  start(): void {
    if (!this.view) return;
    if (this.animId != null) return;
    this.animId = -1;

    document.addEventListener("keydown", this.boundKeyDown);
    document.addEventListener("keyup", this.boundKeyUp);

    if (this.placed) {
      this.resumeLoop();
      this.placeChaseCamera(
        this.state.lat,
        this.state.lng,
        this.state.alt,
        this.cameraHeading,
      );
      this.applyModelVisibility();
      return;
    }
    this.placed = true;

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
          // The initial clip is idle, so start it at the idle clip's speed.
          animationSpeed: this.clipSpeed(animation.idleClip),
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
        if (!this.view || this.animId == null) return;
        this.resumeLoop();
      });
    } else {
      this.resumeLoop();
    }

    this.applyInitialCamera();
    this.applyModelVisibility();
  }

  /**
   * Hand the camera back to the view's own controls and stop reading the
   * movement keys, leaving the character where it stands. {@link start}
   * resumes from there — use the two to step out of person view and back
   * without losing the position.
   */
  stop(): void {
    if (this.animId == null) return;
    this.releaseControl();

    // Both camera modes are released: whichever was driving, the view's own
    // controls take over from where it left the camera.
    this.view?.cameraFollow(false);
    this.view?.cameraFreeLook(false);

    // Nothing is driving the character any more, so it stands idle.
    this.playAnimation(this.character?.animation.idleClip);
    const stopped: PersonViewState = {
      ...this.state,
      speed: 0,
      animationState: this.currentAnimState,
    };
    if (this.hasStateChanged(this.state, stopped)) {
      this.state = stopped;
      this.notify();
    }
  }

  /** Stop the per-frame loop and the key handling, keeping everything else. */
  private releaseControl(): void {
    if (this.animId != null && this.animId >= 0)
      cancelAnimationFrame(this.animId);
    this.animId = null;

    document.removeEventListener("keydown", this.boundKeyDown);
    document.removeEventListener("keyup", this.boundKeyUp);

    // Keys held at the moment control is released would otherwise still read as
    // held when it is taken back.
    this.heldActions.clear();
    this.orbitKeyHeld = false;
    this.orbitLatched = false;
    this.dashHeld = false;
  }

  /**
   * Run the per-frame loop from now. The clock restarts with it, so a pause
   * between `stop()` and `start()` is not delivered as one enormous frame.
   */
  private resumeLoop(): void {
    this.lastTime = performance.now();
    this.animId = requestAnimationFrame(this.tick);
  }

  /** Instantly move to a new geographic position. */
  teleport(options: TeleportOptions): void {
    if (!this.view) return;

    const { lng, lat } = options;
    const headingRad =
      options.heading != null ? options.heading : this.cameraHeading;
    // A teleport lands on the terrain outright rather than settling onto it.
    const destination = { lat: degreeToRadian(lat), lng: degreeToRadian(lng) };
    const alt = this.resolveGroundHeight(
      destination,
      destination,
      options.alt,
      0,
    );
    this.updateSlopeTilt(destination.lat, destination.lng, alt, 0);

    if (this.handle && this.character) {
      const pos = geodeticToVector3({
        lat: destination.lat,
        lng: destination.lng,
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

  /**
   * Subscribe to control-input events. The callback fires once per keypress of
   * any bound action (movement, dash, view toggle, orbit) — for example, to
   * hide an on-screen controls hint once the user starts driving the
   * character. Returns an unsubscribe function.
   */
  onAction(fn: ActionListener): () => void {
    this.actionListeners.add(fn);
    return () => this.actionListeners.delete(fn);
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
   * Update the terrain collision settings at runtime. Only the given fields
   * change; the rest keep their current values.
   */
  setCollision(collision: CollisionConfig): void {
    this.collision = { ...this.collision, ...collision };
  }

  /** Current terrain collision settings. */
  getCollision(): Readonly<ResolvedCollision> {
    return this.collision;
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

  /**
   * Set the base animation playback speed — the fallback used by any clip
   * without a per-clip override (`idleSpeed` / `walkSpeed` / `dashSpeed`).
   * Re-applies to the clip currently playing, so it takes effect immediately.
   */
  setAnimationSpeed(speed: number): void {
    if (this.character) this.character.animation.speed = speed;
    this.modelRef?.setAnimationSpeed(this.clipSpeed(this.currentAnimState));
  }

  /** Current base animation playback speed (per-clip overrides aside). */
  getAnimationSpeed(): number {
    return this.character?.animation.speed ?? 1;
  }

  /**
   * The loaded character model's mesh handle, or `null` before {@link start}
   * has loaded it (or when no character is configured). Its `ref` is the
   * GLTFModelDesc — reach the model itself through it, e.g. `model.ref.raw`
   * for the underlying three.js object or `model.ref.getWorldPosition()`.
   */
  get model(): MeshHandle<GLTFModelDesc> | null {
    return this.handle;
  }

  /**
   * Resolve the effective playback speed for a clip: its per-clip override
   * (`idleSpeed` / `walkSpeed` / `dashSpeed`) if set, else the base `speed`.
   */
  private clipSpeed(clip: string | null): number {
    const a = this.character?.animation;
    if (!a) return 1;
    if (clip === a.dashClip) return a.dashSpeed ?? a.speed ?? 1;
    if (a.walkClip != null && clip === a.walkClip)
      return a.walkSpeed ?? a.speed ?? 1;
    return a.idleSpeed ?? a.speed ?? 1;
  }

  dispose(): void {
    this.releaseControl();

    if (this.handle) {
      this.handle.delete();
      this.handle = null;
    }
    this.modelRef = null;
    this.placed = false;
    this.listeners.clear();
    this.actionListeners.clear();
    this.view = undefined;
  }

  /** Cross-fade the model onto `clip`, unless it is already the one playing. */
  private playAnimation(clip: string | undefined): void {
    if (!clip || !this.character || !this.modelRef) return;
    if (clip === this.currentAnimState) return;
    this.modelRef.crossFadeAnimation(
      this.currentAnimState ?? "",
      clip,
      this.character.animation.crossfadeDuration,
    );
    // Apply the incoming clip's own playback speed.
    this.modelRef.setAnimationSpeed(this.clipSpeed(clip));
    this.currentAnimState = clip;
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
    deltaTime = 0,
  ): void {
    if (!this.view) return;

    const { cameraDistance, fpvPitch, fpvForwardOffset } = this.config;
    const isFpv = this.viewMode === "fpv";
    const eyeHeight = this.eyeHeightAt(alt);

    if (isFpv) {
      // FPV: the eye is locked to the person's position at eye height.
      // The pitch tilts the view down *in place* by lowering the look-at
      // target while a matching upward offset keeps the eye itself at
      // `eyeHeight` — only the look direction changes, not the position.
      //
      // The target sits far ahead and the camera is offset back by the
      // same distance, so the camera ends up at the eye looking forward.
      const backDistance = FPV_LOOK_AHEAD_DISTANCE;
      const lookAheadDistance = fpvForwardOffset + FPV_LOOK_AHEAD_DISTANCE;
      const pitch = this.followSlopeWithPitch(
        fpvPitch,
        lat,
        lng,
        alt,
        heading,
        deltaTime,
      );
      const targetDrop = Math.tan(pitch) * backDistance;
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

    // TPV: orbit the camera around the model, staying aimed at it so it keeps
    // its place in frame. The eye sits at `cameraDistance`, pulled back by
    // `cos(pitch)` horizontally and up by `sin(pitch)`.
    const pitch = this.followSlopeWithPitch(
      this.config.cameraPitch,
      lat,
      lng,
      alt,
      heading,
      deltaTime,
    );
    const horizontal = cameraDistance * Math.cos(pitch);
    const vertical = cameraDistance * Math.sin(pitch);

    // The eye rides the character's own height: the terrain settling already
    // lives in that altitude, so filtering it again would only add lag.
    this._offset.set(
      -Math.sin(heading) * horizontal,
      -Math.cos(heading) * horizontal,
      vertical,
    );

    this.view.cameraFollow(true, { lat, lng, height: eyeHeight }, this._offset);
  }

  /**
   * Tilt `configured` (radians) with the slope the character is walking along,
   * eased in over time. Position in degrees, `alt` in meters.
   *
   * A fixed pitch hugs a horizontal plane while the ground does not: on a steep
   * climb the view runs into the hillside and the frame fills with ground. The
   * slope is taken over the chase distance either side of the character, and
   * fades out as it rises off the surface so a flying character in `"clamp"`
   * mode keeps the pitch it was configured with.
   */
  private followSlopeWithPitch(
    configured: number,
    lat: number,
    lng: number,
    alt: number,
    heading: number,
    deltaTime: number,
  ): number {
    const { cameraDistance, cameraLerpSpeed } = this.config;
    const { mode, cameraSlopeFollow } = this.collision;

    let target = 0;
    if (mode !== "off" && cameraSlopeFollow > 0) {
      const ahead = this.terrainAlong(lat, lng, heading, cameraDistance);
      const behind = this.terrainAlong(
        lat,
        lng,
        heading + Math.PI,
        cameraDistance,
      );
      if (ahead !== undefined && behind !== undefined) {
        target = MathUtils.clamp(
          Math.atan2(ahead - behind, 2 * cameraDistance) *
            cameraSlopeFollow *
            this.groundedFactor(alt, cameraDistance),
          -MAX_CAMERA_SLOPE_PITCH,
          MAX_CAMERA_SLOPE_PITCH,
        );
      }
    }
    // Eased: the slope is read a chase distance away, where the ground can
    // change far faster than it does under the character.
    this.cameraSlopePitch +=
      (target - this.cameraSlopePitch) * easeFactor(cameraLerpSpeed, deltaTime);
    return configured - this.cameraSlopePitch;
  }

  /**
   * How much the ground still applies to a character at `alt`: `1` standing on
   * the surface, fading to `0` once it is `scale` meters above it. Nothing the
   * terrain does should tilt a character that is flying over it in `"clamp"`
   * mode — neither the model nor the view follows a slope it has left behind.
   */
  private groundedFactor(alt: number, scale: number): number {
    const surface = this.groundSurfaceHeight;
    if (surface === undefined) return 0;
    return MathUtils.clamp(1 - (alt - surface) / scale, 0, 1);
  }

  /** Terrain height `meters` along `heading` from a position in degrees. */
  private terrainAlong(
    lat: number,
    lng: number,
    heading: number,
    meters: number,
  ): number | undefined {
    const at = this.advanceLatLng(lat, lng, heading, meters);
    return this.sampleTerrain(degreeToRadian(at.lat), degreeToRadian(at.lng));
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
   *
   * After the heading the frame's axes are X = right, Y = forward,
   * Z = up, so `alignToSlope` tilts around X (nose up when climbing)
   * then around Y (roll onto the side of the slope).
   */
  private composeCharacterFrame(pos: Vector3, heading: number): Matrix4 {
    const enuFrame = eastNorthUpToFixedFrame(pos);
    this._headingMatrix.makeRotationZ(-heading);
    this._characterFrame.multiplyMatrices(enuFrame, this._headingMatrix);

    const gradEast = this.slopeGradEast;
    const gradNorth = this.slopeGradNorth;
    if (gradEast !== 0 || gradNorth !== 0) {
      const sin = Math.sin(heading);
      const cos = Math.cos(heading);
      const limit = this.collision.maxSlopeTilt;
      // Rise per meter along the character's own axes: forward is
      // (sin, cos) in ENU and right is (cos, -sin).
      const pitch = MathUtils.clamp(
        Math.atan(gradEast * sin + gradNorth * cos),
        -limit,
        limit,
      );
      const roll = MathUtils.clamp(
        -Math.atan(gradEast * cos - gradNorth * sin),
        -limit,
        limit,
      );

      this._tiltMatrix.makeRotationX(pitch);
      this._characterFrame.multiply(this._tiltMatrix);
      this._tiltMatrix.makeRotationY(roll);
      this._characterFrame.multiply(this._tiltMatrix);
    }

    return this._characterFrame;
  }

  /** Eye-line height (meters) for a character standing at `alt`. */
  private eyeHeightAt(alt: number): number {
    return alt + this.config.fpvHeightOffset;
  }

  /** Terrain height at a position in radians, or `undefined` if not loaded. */
  private sampleTerrain(lat: number, lng: number): number | undefined {
    return this.view?.sampleTerrainHeight({ lat, lng, height: 0 });
  }

  /**
   * Apply terrain collision to a candidate altitude (meters). Positions are in
   * radians. `deltaTime` drives the absorption of terrain data changes — pass
   * `0` to land on the terrain the sampler reports right now.
   */
  private resolveGroundHeight(
    at: LatLngRadians,
    from: LatLngRadians,
    height: number,
    deltaTime: number,
  ): number {
    const { mode, groundOffset } = this.collision;
    if (mode === "off") {
      this.forgetGroundSamples();
      return height;
    }

    const terrain = this.sampleTerrain(at.lat, at.lng);
    // Terrain tiles for this spot are not loaded yet. Keep the caller's
    // altitude — snapping to a fallback would drop the character to sea level.
    if (terrain === undefined) {
      this.forgetGroundSamples();
      return height;
    }
    this.groundSurfaceHeight = terrain + groundOffset;
    const floor =
      this.groundSurfaceHeight -
      this.absorbGroundDataShift(at, from, terrain, height, deltaTime);
    // The floor already tracks the surface exactly as the character walks over
    // it, so a climb can never bury it and the ground never has to shove it
    // upward out of turn.
    return mode === "ground" ? floor : Math.max(height, floor);
  }

  /**
   * Absorb terrain that moved because its *data* changed rather than because
   * the character did, and return how much of that shift is still being held
   * back (meters, positive when the data rose).
   *
   * Only one of the two is real ground: walking onto higher ground has to move
   * the character at once or a climb buries it, while a tile re-measured at a
   * finer LOD moving the surface hundreds of meters must not. Re-sampling the
   * *previous* frame's position separates them — whatever the height there has
   * changed by is data, and the rest is the character having moved.
   */
  private absorbGroundDataShift(
    at: LatLngRadians,
    from: LatLngRadians,
    terrain: number,
    height: number,
    deltaTime: number,
  ): number {
    const previous = this.lastGroundSample;
    let shift: number;
    if (previous === undefined) {
      // First contact with the terrain, at load or once tiles reach a spot the
      // character was standing over unloaded ground on: the gap to the surface
      // is the shift, so it glides down instead of dropping out of the sky.
      shift =
        (this.sampleTerrain(from.lat, from.lng) ?? terrain) +
        this.collision.groundOffset -
        height;
    } else {
      const before = this.sampleTerrain(previous.lat, previous.lng);
      // The spot just left has gone unloaded: nothing can be attributed.
      shift = before === undefined ? 0 : before - previous.height;
    }

    const carried = this.unabsorbedGroundShift + shift;
    const toward = Math.sign(carried);
    if (deltaTime > 0) {
      // Speed builds up while the gap stays on the same side, and starts over
      // whenever the surface crosses the character — it has landed by then.
      if (toward !== Math.sign(this.settleVelocity)) this.settleVelocity = 0;
      this.settleVelocity += toward * GROUND_SETTLE_ACCELERATION * deltaTime;
    }
    // A frame of no length is a teleport or a first placement: land outright.
    const step =
      deltaTime > 0
        ? Math.abs(this.settleVelocity) * deltaTime
        : Math.abs(carried);
    this.unabsorbedGroundShift = toward * Math.max(0, Math.abs(carried) - step);
    if (this.unabsorbedGroundShift === 0) this.settleVelocity = 0;
    this.lastGroundSample = { lat: at.lat, lng: at.lng, height: terrain };
    return this.unabsorbedGroundShift;
  }

  /** Drop the terrain history, so the next sample starts a fresh landing. */
  private forgetGroundSamples(): void {
    this.lastGroundSample = undefined;
    this.unabsorbedGroundShift = 0;
    this.settleVelocity = 0;
    this.groundSurfaceHeight = undefined;
  }

  /**
   * Refresh the terrain gradient the slope tilt is built from, by probing a
   * ring of points around the character (position in radians, `alt` in meters).
   * `deltaTime` drives the smoothing — pass `0` to snap.
   */
  private updateSlopeTilt(
    lat: number,
    lng: number,
    alt: number,
    deltaTime: number,
  ): void {
    const { mode, alignToSlope, slopeSampleDistance } = this.collision;

    let gradEast = 0;
    let gradNorth = 0;
    if (mode !== "off" && alignToSlope) {
      const gradient = this.measureSlopeGradient(lat, lng);
      // A missing probe would fake a cliff, so hold the current tilt until the
      // terrain around the character is fully loaded.
      if (!gradient) return;
      // Its own footprint is the scale at which it is still standing on the
      // ground rather than flying over it.
      const grounded = this.groundedFactor(alt, slopeSampleDistance);
      gradEast = gradient.east * grounded;
      gradNorth = gradient.north * grounded;
    } else if (this.slopeGradEast === 0 && this.slopeGradNorth === 0) {
      return;
    }

    const factor = easeFactor(SLOPE_TILT_SMOOTHING, deltaTime);
    this.slopeGradEast += (gradEast - this.slopeGradEast) * factor;
    this.slopeGradNorth += (gradNorth - this.slopeGradNorth) * factor;
  }

  /**
   * Terrain gradient (rise per meter, east and north) under a point given in
   * radians, fitted to a ring of probes, or `undefined` while any of them is
   * over terrain that has not loaded. The probes sit a few meters apart, so
   * they share one ENU frame rather than each re-deriving its own.
   */
  private measureSlopeGradient(
    lat: number,
    lng: number,
  ): { east: number; north: number } | undefined {
    const distance = this.collision.slopeSampleDistance;
    const center = geodeticToVector3({ lat, lng, height: 0 });
    const enu: Matrix4 = eastNorthUpToFixedFrame(center);
    this._east.setFromMatrixColumn(enu, 0).normalize();
    this._north.setFromMatrixColumn(enu, 1).normalize();

    let sumEast = 0;
    let sumNorth = 0;
    for (const { sin, cos } of SLOPE_PROBE_BEARINGS) {
      this._probePos
        .copy(center)
        .addScaledVector(this._east, sin * distance)
        .addScaledVector(this._north, cos * distance);
      const probe = vector3ToGeodetic(this._probePos);
      const terrain = this.sampleTerrain(probe.lat, probe.lng);
      if (terrain === undefined) return undefined;
      sumEast += terrain * sin;
      sumNorth += terrain * cos;
    }

    // Least-squares gradient of the plane through the ring, which for evenly
    // spaced bearings reduces to this weighted mean.
    const scale = 2 / (SLOPE_PROBE_BEARINGS.length * distance);
    return { east: sumEast * scale, north: sumNorth * scale };
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

  private emitAction(action: Action): void {
    for (const fn of this.actionListeners) fn(action);
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

    // Notify listeners once per physical press (ignore auto-repeat), before
    // the action-specific handling below so every control input is reported.
    if (!e.repeat) this.emitAction(action);

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
      this.dashHeld = true;
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
      this.dashHeld = false;
      return;
    }
    this.heldActions.delete(action);
  }

  private tick = (currentTime: number): void => {
    // A frame already scheduled when control was released must not drive the
    // character, nor schedule another one behind `stop()`.
    if (!this.view || this.animId == null) return;
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

    // Derive the speed factor from the held state, so animation choice
    // (dashHeld) stays independent of the numeric multiplier.
    const dashMultiplier = this.dashHeld ? this.config.dashSpeedMultiplier : 1;

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
        moveSpeed * dashMultiplier * deltaTime * dirY,
      );
    }

    const advancedLLE = vector3ToGeodetic(curPos);
    // Ground mode lets the terrain set the altitude, so the ascend / descend
    // keys and the limits that bound them play no part. Collision runs last
    // either way, or `maxAlt` could push the character underground.
    const flownHeight =
      this.collision.mode === "ground"
        ? currentLLE.height
        : MathUtils.clamp(
            currentLLE.height + dirZ * altSpeed * deltaTime,
            minAlt,
            maxAlt,
          );
    const height = this.resolveGroundHeight(
      advancedLLE,
      currentLLE,
      flownHeight,
      deltaTime,
    );
    const nextLat = radianToDegree(advancedLLE.lat);
    const nextLng = radianToDegree(advancedLLE.lng);
    const nextAlt = height;

    this.updateSlopeTilt(advancedLLE.lat, advancedLLE.lng, height, deltaTime);

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
    this.cameraHeading += headingDiff * easeFactor(cameraLerpSpeed, deltaTime);

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
          height: this.eyeHeightAt(nextAlt),
        });
      } else {
        // Keep the orbit pivot at the same eye height used everywhere
        // else so switching between free and chase camera is seamless.
        this.view.cameraFollow(true, {
          lat: nextLat,
          lng: nextLng,
          height: this.eyeHeightAt(nextAlt),
        });
      }
    } else {
      this.placeChaseCamera(
        nextLat,
        nextLng,
        nextAlt,
        this.cameraHeading,
        deltaTime,
      );
    }

    const isMoving = dirY !== 0 || dirX !== 0 || dirZ !== 0;
    const isDashing = isMoving && this.dashHeld;

    let nextAnimState = this.currentAnimState;
    if (this.character) {
      const { animation } = this.character;
      const walkClip = animation.walkClip ?? animation.idleClip;
      nextAnimState = isDashing
        ? animation.dashClip
        : isMoving
          ? walkClip
          : animation.idleClip;
      this.playAnimation(nextAnimState);
    }

    const nextState: PersonViewState = {
      lng: nextLng,
      lat: nextLat,
      alt: nextAlt,
      heading: this.modelHeading,
      speed: moveSpeed * dashMultiplier,
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
