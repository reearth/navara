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
 * import ThreeView from "@navara/three";
 * import { DefaultPlugin } from "@navara/three_default_plugin";
 * import { PersonViewPlugin } from "@navara/three_plugins";
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
 * personView.teleport(lng, lat, alt, headingDeg);
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
} from "@navara/three";
import type { GLTFModelDesc } from "@navara/three_default_descs";
import type { DefaultDescriptions } from "@navara/three_default_plugin";
import { Vector3, Matrix4 } from "three";

type View = ThreeView<DefaultDescriptions>;

export type ViewMode = "tpv" | "fpv";

export type PersonViewState = {
  lng: number;
  lat: number;
  alt: number;
  /** Heading in degrees — 0 = north, 90 = east. */
  heading: number;
  speed: number;
  /** Current animation clip name, or null when no character is configured. */
  animationState: string | null;
  mode: ViewMode;
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
  cameraHeight?: number;
  cameraLerpSpeed?: number;
  /** Forward offset (meters) applied to the FPV eye position. */
  fpvForwardOffset?: number;
  /** Height offset (meters) applied to the FPV eye position. */
  fpvHeightOffset?: number;

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
  cameraHeight: 20,
  cameraLerpSpeed: 3,
  fpvForwardOffset: 1.5,
  fpvHeightOffset: 5,
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
      heading: radianToDegree(this.config.startHeading),
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

  /**
   * Instantly move to a new geographic position.
   * @param heading - Optional heading in degrees. If omitted, the current camera heading is kept.
   */
  teleport(lng: number, lat: number, alt: number, heading?: number): void {
    if (!this.view) return;

    const headingRad =
      heading != null ? degreeToRadian(heading) : this.cameraHeading;

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
      heading: radianToDegree(headingRad),
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
    if (this.viewMode === "fpv") return false;
    return this.config.allowCameraControl || this.orbitKeyHeld;
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
   * Unified chase-camera placement for both TPV and FPV.
   * Caller supplies the heading (radians) to use — lerped during the
   * per-frame loop, snapped on teleport / init.
   */
  private placeChaseCamera(
    lat: number,
    lng: number,
    alt: number,
    heading: number,
  ): void {
    if (!this.view) return;

    const { cameraDistance, cameraHeight, fpvHeightOffset, fpvForwardOffset } =
      this.config;
    const isFpv = this.viewMode === "fpv";

    // Place the look-at target ahead of the eye so the camera, offset
    // back by the same distance, ends up at the eye looking forward.
    // For TPV the eye is the model; we still aim the camera slightly
    // ahead of the model so the chase shot is centered on what's ahead.
    const lookAheadDistance = isFpv
      ? fpvForwardOffset + FPV_LOOK_AHEAD_DISTANCE
      : 0;
    const backDistance = isFpv ? FPV_LOOK_AHEAD_DISTANCE : cameraDistance;
    const upOffset = isFpv ? 0 : cameraHeight;
    const targetHeight = alt + (isFpv ? fpvHeightOffset : 1);

    const target =
      lookAheadDistance > 0
        ? this.advanceLatLng(lat, lng, heading, lookAheadDistance)
        : { lat, lng };

    this._offset.set(
      -Math.sin(heading) * backDistance,
      -Math.cos(heading) * backDistance,
      upOffset,
    );

    this.view.cameraFollow(
      true,
      { lat: target.lat, lng: target.lng, height: targetHeight },
      this._offset,
    );
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
      this.toggleViewMode();
      return;
    }
    if (action === "orbitCamera") {
      this.orbitKeyHeld = true;
      return;
    }

    if (this.movementSuppressed) return;

    if (action === "dash") {
      this.dashMultiplier = 2.5;
      return;
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
      this.view.cameraFollow(true, {
        lat: nextLat,
        lng: nextLng,
        height: nextAlt + 1,
      });
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
      heading: radianToDegree(this.modelHeading),
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
