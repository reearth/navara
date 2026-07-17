import { Matrix4, type PerspectiveCamera } from "three";

import { ScreenCollisionGrid } from "./grid";
import {
  isBeyondHorizon,
  projectCandidateInto,
  type ProjectionContext,
} from "./projection";
import type { DeclutterCandidate, DeclutterParticipant } from "./types";

export type DeclutterUpdateResult =
  /** Nothing to do: no participants, or camera and data unchanged. */
  | "idle"
  /** A placement pass ran; results are applied to the participants. */
  | "ran"
  /** Labels are mid-fade — the caller should schedule a prompt follow-up
   *  frame so the animation keeps stepping. */
  | "animating"
  /** A pass is due but the throttle window hasn't elapsed — the caller should
   *  schedule another frame so placement settles after the camera stops. */
  | "throttled";

/**
 * Shared screen-space label decluttering.
 *
 * Text batches and sprite meshes register as participants; each placement
 * pass projects every candidate label's anchor to the screen, sorts by
 * priority, and greedily claims space in a {@link ScreenCollisionGrid} —
 * losers are hidden through the meshes' declutter channels (`uDeclutterHide`
 * uniform / `instanceDeclutterHide` attribute), which are separate from
 * user-driven `show` state and free to toggle every pass.
 *
 * Placement is hysteretic: currently-shown labels win equal-priority ties
 * and tolerate {@link DeclutterManager.HYSTERESIS_PX} of marginal overlap
 * before eviction, so near-ties don't flicker while the camera drifts.
 *
 * The pass is view-dependent, so it runs from the render loop — but throttled:
 * placement only re-runs when the camera or the label set actually changed,
 * and at most once per {@link DeclutterManager.MIN_INTERVAL_MS}. Callers run
 * it *before* rendering so results land in the same frame.
 */
export class DeclutterManager {
  /** Minimum time between placement passes (ms). */
  static readonly MIN_INTERVAL_MS = 150;
  /** Padding added around every collision box (px); two labels never sit
   *  closer than twice this. */
  static readonly PADDING_PX = 2;
  /** Largest single fade step (ms), so a frame after an idle gap doesn't
   *  swallow most of a fade in one jump. */
  static readonly MAX_FADE_STEP_MS = 50;
  /** Placement hysteresis (px): a currently-shown label's collision test box
   *  shrinks by this per side, so it survives marginal overlaps that camera
   *  drift toggles frame to frame instead of flickering. Its full box is
   *  still claimed against competitors. */
  static readonly HYSTERESIS_PX = 6;

  private _participants = new Set<DeclutterParticipant>();
  /** Set when the label set changed (register/update/text change) so the next
   *  update re-places even with a static camera. */
  private _dirty = true;

  // Snapshot of the camera/viewport the last pass ran with.
  private _prevCamera = new Float64Array(34).fill(Number.NaN);
  private _lastRunAt = Number.NEGATIVE_INFINITY;
  private _lastStepAt = Number.NaN;

  // Reused per-pass scratch to keep steady-state allocations low.
  private _grid = new ScreenCollisionGrid();
  private _candidates: DeclutterCandidate[] = [];
  private _order: number[] = [];
  private _boxes = new Float64Array(0);
  private _placeable = new Uint8Array(0);
  private _viewMatrix = new Matrix4();

  register(participant: DeclutterParticipant): void {
    this._participants.add(participant);
    this._dirty = true;
  }

  unregister(participant: DeclutterParticipant): void {
    if (this._participants.delete(participant)) {
      this._dirty = true;
    }
  }

  /** Signal that candidates changed (text, positions, visibility, style) so
   *  the next update re-runs placement even if the camera is still. */
  markDirty(): void {
    this._dirty = true;
  }

  /**
   * Run a placement pass if one is due, then advance any active show/hide
   * fades. `widthPx`/`heightPx` are the viewport in CSS pixels (matching the
   * `uScreenHeightPx` uniform); `nowMs` is the frame timestamp used for
   * throttling and fade stepping.
   */
  update(
    camera: PerspectiveCamera,
    widthPx: number,
    heightPx: number,
    nowMs: number,
  ): DeclutterUpdateResult {
    if (this._participants.size === 0) return "idle";

    let ran = false;
    let throttled = false;
    if (this._dirty || this._snapshotChanged(camera, widthPx, heightPx)) {
      if (nowMs - this._lastRunAt >= DeclutterManager.MIN_INTERVAL_MS) {
        this._run(camera, widthPx, heightPx);
        this._takeSnapshot(camera, widthPx, heightPx);
        this._dirty = false;
        this._lastRunAt = nowMs;
        ran = true;
      } else {
        throttled = true;
      }
    }

    // Step fades even when no pass ran — placement only sets targets; the
    // animation itself advances here, frame by frame. Clamp the step so the
    // first frame after an idle gap doesn't jump most of the fade at once.
    const deltaMs = Number.isFinite(this._lastStepAt)
      ? Math.min(nowMs - this._lastStepAt, DeclutterManager.MAX_FADE_STEP_MS)
      : 0;
    this._lastStepAt = nowMs;
    let animating = false;
    for (const p of this._participants) {
      animating = p.stepDeclutterFade(deltaMs) || animating;
    }

    // "animating" wins over "throttled": its prompt follow-up frames re-enter
    // this method, so a pending throttled pass still runs once the window
    // elapses.
    if (animating) return "animating";
    if (throttled) return "throttled";
    return ran ? "ran" : "idle";
  }

  private _run(
    camera: PerspectiveCamera,
    widthPx: number,
    heightPx: number,
  ): void {
    const candidates = this._candidates;
    candidates.length = 0;
    for (const p of this._participants) {
      p.collectDeclutterCandidates(candidates);
    }
    const n = candidates.length;
    if (this._boxes.length < n * 4) {
      this._boxes = new Float64Array(n * 4);
      this._placeable = new Uint8Array(n);
    }

    // The pass may run before the renderer refreshed matrixWorldInverse, so
    // derive the view matrix from matrixWorld instead of trusting it.
    const view = this._viewMatrix.copy(camera.matrixWorld).invert();
    const cam = camera.matrixWorld.elements;
    const ctx: ProjectionContext = {
      viewMatrix: view,
      projectionMatrix: camera.projectionMatrix,
      cameraX: cam[12],
      cameraY: cam[13],
      cameraZ: cam[14],
      near: camera.near,
      widthPx,
      heightPx,
      // Plain math instead of @navara/three_api's degreeToRadian — that one
      // is a WASM call, which the placement pass must not depend on.
      fovRad: (camera.fov * Math.PI) / 180.0,
    };

    for (let i = 0; i < n; i++) {
      const c = candidates[i];
      const visible =
        !isBeyondHorizon(
          c.anchorX,
          c.anchorY,
          c.anchorZ,
          ctx.cameraX,
          ctx.cameraY,
          ctx.cameraZ,
        ) && projectCandidateInto(c, ctx, this._boxes, i * 4);
      this._placeable[i] = visible ? 1 : 0;
    }

    // Priority order with hysteresis: among equal priorities, currently-shown
    // labels place first (incumbents win ties — otherwise a competitor
    // entering the viewport margin could displace a stable label mid-pan).
    // The final camera-independent tiebreak (anchor position, then handle)
    // keeps fresh ties deterministic — array order would reshuffle as tiles
    // load and make labels flicker.
    const order = this._order;
    order.length = n;
    for (let i = 0; i < n; i++) order[i] = i;
    order.sort((a, b) => {
      const ca = candidates[a];
      const cb = candidates[b];
      if (ca.priority !== cb.priority) return cb.priority - ca.priority;
      if (ca.isShown !== cb.isShown) return ca.isShown ? -1 : 1;
      if (ca.anchorX !== cb.anchorX) return ca.anchorX - cb.anchorX;
      if (ca.anchorY !== cb.anchorY) return ca.anchorY - cb.anchorY;
      if (ca.anchorZ !== cb.anchorZ) return ca.anchorZ - cb.anchorZ;
      return a - b;
    });

    const grid = this._grid;
    grid.reset(widthPx, heightPx);
    const pad = DeclutterManager.PADDING_PX;
    for (const i of order) {
      const c = candidates[i];
      if (this._placeable[i] === 0) {
        // Behind the camera or beyond the horizon: the GPU hides it already.
        // Leave it un-decluttered so it shows the moment it comes back, and
        // claim no space for it.
        c.owner.applyDeclutter(c.handle, false);
        continue;
      }
      const o = i * 4;
      // Shown labels get a shrunk collision test (sticky: marginal overlaps
      // don't evict them); hidden labels need their full padded box free
      // before they may appear. The asymmetry is what damps threshold
      // oscillation during slow camera drift.
      const free = grid.insertIfFree(
        this._boxes[o] - pad,
        this._boxes[o + 1] - pad,
        this._boxes[o + 2] + pad,
        this._boxes[o + 3] + pad,
        c.isShown ? DeclutterManager.HYSTERESIS_PX : 0,
      );
      c.owner.applyDeclutter(c.handle, !free);
    }

    candidates.length = 0;
  }

  private _snapshotChanged(
    camera: PerspectiveCamera,
    widthPx: number,
    heightPx: number,
  ): boolean {
    const s = this._prevCamera;
    const world = camera.matrixWorld.elements;
    const proj = camera.projectionMatrix.elements;
    for (let i = 0; i < 16; i++) {
      if (s[i] !== world[i] || s[16 + i] !== proj[i]) return true;
    }
    return s[32] !== widthPx || s[33] !== heightPx;
  }

  private _takeSnapshot(
    camera: PerspectiveCamera,
    widthPx: number,
    heightPx: number,
  ): void {
    const s = this._prevCamera;
    s.set(camera.matrixWorld.elements, 0);
    s.set(camera.projectionMatrix.elements, 16);
    s[32] = widthPx;
    s[33] = heightPx;
  }
}
