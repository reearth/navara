/**
 * One label/sprite competing for screen space in a declutter pass.
 *
 * The local box is expressed around the projected anchor in the shader's
 * billboard-local units — CSS pixels when `sizeInMeters` is false, meters
 * otherwise — with +X right and +Y up (view-space convention). The manager
 * converts it to a screen-pixel AABB using the same `nvr_pxToWorld` math the
 * vertex shaders use, so the collision box matches what is actually drawn.
 */
export type DeclutterCandidate = {
  /** World-space anchor in ECEF meters (f64), before the height offset. */
  anchorX: number;
  anchorY: number;
  anchorZ: number;
  /** Extra offset in meters along the spherical surface normal — CPU mirror
   *  of `mvr_getMvHeightOffset` (sprite_height_pars_vertex.glsl). */
  addHeight: number;
  /** Local box around the anchor (px or meters, see `sizeInMeters`). */
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  /** Unit of the local box, mirroring the material's `sizeInMeters`. */
  sizeInMeters: boolean;
  /** Placement priority: higher wins an overlap. */
  priority: number;
  /** Participant that owns this candidate; receives the placement result. */
  owner: DeclutterParticipant;
  /** Participant-defined id (mesh index for text batches, instance index for
   *  sprites) passed back to `applyDeclutter`. */
  handle: number;
};

/** A mesh that contributes label candidates to the shared declutter pass. */
export type DeclutterParticipant = {
  /**
   * Append the currently-visible, declutter-enabled candidates to `out`.
   * Called once per placement pass; must not retain `out`.
   */
  collectDeclutterCandidates: (out: DeclutterCandidate[]) => void;
  /**
   * Apply a placement result. Must be cheap and idempotent — the pass calls
   * it for every candidate on every run, most often with an unchanged value.
   */
  applyDeclutter: (handle: number, hidden: boolean) => void;
};
