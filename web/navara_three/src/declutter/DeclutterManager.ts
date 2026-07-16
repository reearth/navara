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

  private _participants = new Set<DeclutterParticipant>();
  /** Set when the label set changed (register/update/text change) so the next
   *  update re-places even with a static camera. */
  private _dirty = true;

  // Snapshot of the camera/viewport the last pass ran with.
  private _prevCamera = new Float64Array(34).fill(Number.NaN);
  private _lastRunAt = Number.NEGATIVE_INFINITY;

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
   * Run a placement pass if one is due. `widthPx`/`heightPx` are the viewport
   * in CSS pixels (matching the `uScreenHeightPx` uniform); `nowMs` is the
   * frame timestamp used for throttling.
   */
  update(
    camera: PerspectiveCamera,
    widthPx: number,
    heightPx: number,
    nowMs: number,
  ): DeclutterUpdateResult {
    if (this._participants.size === 0) return "idle";
    if (!this._dirty && !this._snapshotChanged(camera, widthPx, heightPx)) {
      return "idle";
    }
    if (nowMs - this._lastRunAt < DeclutterManager.MIN_INTERVAL_MS) {
      return "throttled";
    }

    this._run(camera, widthPx, heightPx);
    this._takeSnapshot(camera, widthPx, heightPx);
    this._dirty = false;
    this._lastRunAt = nowMs;
    return "ran";
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

    // Priority order, with a camera-independent tiebreak (anchor position,
    // then handle) so near-ties resolve the same way every pass — array order
    // would reshuffle as tiles load and make labels flicker.
    const order = this._order;
    order.length = n;
    for (let i = 0; i < n; i++) order[i] = i;
    order.sort((a, b) => {
      const ca = candidates[a];
      const cb = candidates[b];
      if (ca.priority !== cb.priority) return cb.priority - ca.priority;
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
      const free = grid.insertIfFree(
        this._boxes[o] - pad,
        this._boxes[o + 1] - pad,
        this._boxes[o + 2] + pad,
        this._boxes[o + 3] + pad,
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
