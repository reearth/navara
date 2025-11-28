import { EventHandler, type FeatureId } from "@navara/core";
import type { Core } from "@navara/engine";

import type { ViewContext } from "./core";
import { FeatureEvaluator } from "./evaluations";
import { applyEffectPayloadToObject } from "./event/featureEvent";
import type { LayerDescription } from "./type";

export type LayerEffectState = {
  effectIds?: string[];
  emissiveIntensity?: number;
  emissiveColor?: number;
  postEffectOcclusion?: boolean;
};

export type LayerEvent = {
  featureCreated: (evaluator: FeatureEvaluator) => void;
  featureUpdated: (evaluator: FeatureEvaluator, updatedAt: number) => void;
  afterFeatureUpdated: () => void;
  deleted: () => void;
};

export type FeatureEvaluatorCallback = (evaluator: FeatureEvaluator) => void;

export class Layer extends EventHandler<LayerEvent> {
  id: string;
  private core: Core;
  private viewContext: ViewContext;
  private layerType?: string;
  private featureEvaluators: Map<FeatureId, FeatureEvaluator> = new Map<
    FeatureId,
    FeatureEvaluator
  >();
  private needUpdate = false;
  private cachedDescription?: LayerDescription;
  private effectState?: LayerEffectState;

  constructor(
    id: string,
    core: Core,
    viewContext: ViewContext,
    layerType?: string,
    initialDescription?: LayerDescription,
  ) {
    super();

    this.id = id;
    this.core = core;
    this.viewContext = viewContext;
    this.layerType = layerType;

    if (initialDescription) {
      this.cachedDescription = cloneLayerDescription(initialDescription);
      if (this.supportsLayerEffects()) {
        this.effectState =
          this.extractEffectPayloadFromDescription(initialDescription);
      }
    }
  }

  /**
   * Register a feature evaluator with this layer
   * @internal Used by the event system
   */
  _registerFeatureEvaluator(featureId: FeatureId, evaluator: FeatureEvaluator) {
    this.featureEvaluators.set(featureId, evaluator);
  }

  /**
   * Get a feature evaluator by ID
   * @internal Used by the event system
   */
  _getFeatureEvaluator(featureId: FeatureId): FeatureEvaluator | undefined {
    return this.featureEvaluators.get(featureId);
  }

  /**
   * Unregister a feature evaluator from this layer
   * @internal Used by the event system
   */
  _unregisterFeatureEvaluator(featureId: FeatureId) {
    this.featureEvaluators.delete(featureId);
  }

  /**
   * Iterate over all feature evaluators registered on this layer
   * @internal Exposed for ViewContext effect updates
   */
  _getFeatureEvaluators(): Iterable<FeatureEvaluator> {
    return this.featureEvaluators.values();
  }

  /**
   * Process feature updates for all registered features
   * @internal Used by the animation loop
   */
  _processFeatureUpdates(updatedAt: number) {
    if (!this.needUpdate) {
      return false;
    }
    this.needUpdate = false;

    // Process all evaluators with the registered callbacks
    for (const evaluator of this.featureEvaluators.values()) {
      // Re-apply layer effects declaratively based on current ViewContext state.
      // This ensures that external changes to effectIds/emissive settings are
      // propagated to existing feature objects (e.g., Drum/Soldier/Chiyoda/Chuo).
      applyEffectPayloadToObject(evaluator.obj, this.viewContext, this.id);
      this.emit("featureUpdated", evaluator, updatedAt);
    }
    this.emit("afterFeatureUpdated");

    return true;
  }

  forceUpdate() {
    this.needUpdate = true;
  }

  update(l: LayerDescription) {
    let effectPayload: LayerEffectState | undefined;
    if (this.supportsLayerEffects()) {
      effectPayload = this.extractEffectPayloadFromDescription(l);
      if (effectPayload) {
        const previousState = this.effectState;
        this.effectState = this.mergeEffectState(effectPayload, false);
        this.applyEffectStateToViewContext(previousState);
        this.updateCachedDescriptionEffects();
      }
    }

    const descriptor = this.supportsLayerEffects()
      ? this.withEffectState(l)
      : l;
    const merged = this.mergeDescription(descriptor);
    this.core.updateLayer(this.id, merged);
  }

  delete() {
    this.core.deleteLayer(this.id);
    this.emit("deleted");
  }

  // ==========================================
  // Effect Management Methods
  // ==========================================

  /**
   * Enable a specific effect for this layer
   * @param effectId - The ID of the effect to enable
   */
  enableEffect(effectId: string): void {
    if (!this.supportsLayerEffects()) {
      return;
    }
    const current = this.viewContext.getLayerEffects(this.id) ?? [];
    if (!current.includes(effectId)) {
      this.updateEffectConfig({
        effectIds: [...current, effectId],
      });
    }
  }

  /**
   * Disable a specific effect for this layer
   * @param effectId - The ID of the effect to disable
   */
  disableEffect(effectId: string): void {
    if (!this.supportsLayerEffects()) {
      return;
    }
    const current = this.viewContext.getLayerEffects(this.id) ?? [];
    // Skip if effect is not currently enabled (optimization)
    if (!current.includes(effectId)) {
      return;
    }
    const updated = current.filter((id) => id !== effectId);
    this.updateEffectConfig({
      effectIds: updated,
    });
  }

  /**
   * Toggle a specific effect for this layer
   * @param effectId - The ID of the effect to toggle
   * @param enabled - Optional explicit state. If not provided, toggles current state
   */
  toggleEffect(effectId: string, enabled?: boolean): void {
    if (!this.supportsLayerEffects()) {
      return;
    }
    const shouldEnable = enabled ?? !this.hasEffect(effectId);
    if (shouldEnable) {
      this.enableEffect(effectId);
    } else {
      this.disableEffect(effectId);
    }
  }

  /**
   * Set all effects for this layer, replacing any existing effects
   * @param effectIds - Array of effect IDs to set
   */
  setEffects(effectIds: string[]): void {
    if (!this.supportsLayerEffects()) {
      return;
    }
    this.updateEffectConfig({
      effectIds: effectIds,
    });
  }

  /**
   * Clear all effects from this layer
   */
  clearEffects(): void {
    if (!this.supportsLayerEffects()) {
      return;
    }
    this.updateEffectConfig({
      effectIds: [],
    });
  }

  /**
   * Get all currently active effects for this layer
   * @returns Array of effect IDs
   */
  getEffects(): string[] {
    return this.viewContext.getLayerEffects(this.id) ?? [];
  }

  /**
   * Check if this layer has a specific effect enabled
   * @param effectId - The ID of the effect to check
   * @returns true if the effect is enabled
   */
  hasEffect(effectId: string): boolean {
    const effects = this.viewContext.getLayerEffects(this.id) ?? [];
    return effects.includes(effectId);
  }

  /**
   * Set the emissive intensity for this layer's materials
   * @param value - The emissive intensity value (typically 0.0 to 10.0)
   */
  setEmissiveIntensity(value: number): void {
    if (!this.supportsLayerEffects()) {
      return;
    }
    this.updateEffectConfig({
      emissive_intensity: value,
    });
  }

  /**
   * Get the current emissive intensity for this layer
   * @returns The emissive intensity value
   */
  getEmissiveIntensity(): number {
    return this.viewContext.getLayerEmissiveIntensity(this.id);
  }

  /**
   * Set the emissive color for this layer's materials
   * @param color - The emissive color as a hex number (e.g., 0xff0000 for red), or undefined to use material color
   */
  setEmissiveColor(color: number | undefined): void {
    if (!this.supportsLayerEffects()) {
      return;
    }
    this.updateEffectConfig({
      emissive_color: color,
    });
  }

  /**
   * Get the current emissive color for this layer
   * @returns The emissive color as a hex number, or undefined if using material color
   */
  getEmissiveColor(): number | undefined {
    return this.viewContext.getLayerEmissiveColor(this.id);
  }

  /**
   * Set the Post Effect Occlusion for this layer
   * @param enabled - Whether Post Effect Occlusion should be enabled
   */
  setPostEffectOcclusion(enabled: boolean): void {
    if (!this.supportsLayerEffects()) {
      return;
    }
    this.updateEffectConfig({
      postEffectOcclusion: enabled,
    });
  }

  /**
   * Get the current Post Effect Occlusion setting for this layer
   * @returns true if Post Effect Occlusion is enabled
   */
  getPostEffectOcclusion(): boolean {
    return this.viewContext.getLayerPostEffectOcclusion(this.id);
  }

  getLayerType(): string | undefined {
    return this.layerType;
  }

  private supportsLayerEffects(): boolean {
    return (
      this.layerType === "geojson" ||
      this.layerType === "cesium3dtiles" ||
      this.layerType === "b3dm" ||
      this.layerType === "pnts" ||
      this.layerType === "mvt" ||
      this.layerType === "terrain"
    );
  }

  private mergeDescription(update: LayerDescription): LayerDescription {
    this.cachedDescription = mergeLayerDescriptions(
      this.cachedDescription,
      update,
    );
    return this.cachedDescription;
  }

  private withEffectState(desc: LayerDescription): LayerDescription {
    if (!this.effectState) {
      return desc;
    }
    const effectFields = this.buildEffectDescriptionFromState();
    if (!effectFields) {
      return desc;
    }
    return mergeLayerDescriptions(desc, effectFields as LayerDescription);
  }

  private buildEffectDescriptionFromState():
    | LayerEffectUpdatePayload
    | undefined {
    if (!this.effectState) {
      return undefined;
    }

    const { effectIds, emissiveColor, emissiveIntensity, postEffectOcclusion } =
      this.effectState;

    if (
      effectIds === undefined &&
      emissiveColor === undefined &&
      emissiveIntensity === undefined &&
      postEffectOcclusion === undefined
    ) {
      return undefined;
    }

    return {
      effectIds: effectIds !== undefined ? [...effectIds] : undefined,
      emissive_color: emissiveColor,
      emissive_intensity: emissiveIntensity,
      postEffectOcclusion,
    };
  }

  private mergeEffectState(
    update: LayerEffectState,
    overwriteMissing: boolean,
  ): LayerEffectState | undefined {
    const next: LayerEffectState = overwriteMissing
      ? {}
      : { ...(this.effectState ?? {}) };

    if (update.effectIds !== undefined) {
      next.effectIds = [...update.effectIds];
    } else if (overwriteMissing) {
      delete next.effectIds;
    }

    if (update.emissiveIntensity !== undefined) {
      next.emissiveIntensity = update.emissiveIntensity;
    } else if (overwriteMissing) {
      delete next.emissiveIntensity;
    }

    if (update.emissiveColor !== undefined) {
      next.emissiveColor = update.emissiveColor;
    } else if (overwriteMissing) {
      delete next.emissiveColor;
    }

    if (update.postEffectOcclusion !== undefined) {
      next.postEffectOcclusion = update.postEffectOcclusion;
    } else if (overwriteMissing) {
      delete next.postEffectOcclusion;
    }

    return Object.keys(next).length > 0 ? next : undefined;
  }

  private applyEffectStateToViewContext(
    previousState?: LayerEffectState,
  ): void {
    const current = this.effectState;

    const effectIdsChanged = !areArraysEqual(
      current?.effectIds,
      previousState?.effectIds,
    );
    const emissiveIntensityChanged =
      current?.emissiveIntensity !== previousState?.emissiveIntensity;
    const emissiveColorChanged =
      current?.emissiveColor !== previousState?.emissiveColor;
    const postEffectOcclusionChanged =
      current?.postEffectOcclusion !== previousState?.postEffectOcclusion;

    if (effectIdsChanged || emissiveIntensityChanged) {
      this.viewContext.updateLayerEffects(
        this.id,
        current?.effectIds,
        current?.emissiveIntensity,
        this.getEffectOptions(),
      );
      // Mark for update so existing feature objects receive updated effect state.
      this.needUpdate = true;
    }

    if (emissiveColorChanged) {
      // Update ViewContext config state (no immediate dispatch for ResourceLayer).
      // PostEffectManager will skip event dispatch for Layer instances,
      // as they use the declarative Rust → FeatureEvent flow.
      this.viewContext.setLayerEmissiveColor(this.id, current?.emissiveColor);
      this.needUpdate = true;
    }

    if (postEffectOcclusionChanged) {
      this.viewContext.setLayerPostEffectOcclusion(
        this.id,
        current?.postEffectOcclusion ?? true,
      );
      this.needUpdate = true;
    }
  }

  _applyExternalEffectState(payload: LayerEffectState): void {
    if (!this.supportsLayerEffects()) return;

    const previousState = this.effectState;
    this.effectState = this.mergeEffectState(payload, true);
    this.applyEffectStateToViewContext(previousState);
    this.updateCachedDescriptionEffects();
  }

  private updateCachedDescriptionEffects() {
    if (!this.cachedDescription) {
      return;
    }
    const effectDescription = this.buildEffectDescriptionFromState();
    if (!effectDescription) {
      return;
    }
    this.cachedDescription = mergeLayerDescriptions(
      this.cachedDescription,
      effectDescription as LayerDescription,
    );
  }

  private updateEffectConfig(payload: LayerEffectUpdatePayload): void {
    this.update(payload as LayerDescription);
  }

  private extractEffectPayloadFromDescription(
    desc: LayerDescription,
  ): LayerEffectState | undefined {
    const partial = desc as LayerEffectUpdatePayload;
    const effectIds = partial.effectIds;
    if (
      effectIds === undefined &&
      partial.emissive_color === undefined &&
      partial.emissive_intensity === undefined &&
      partial.postEffectOcclusion === undefined
    ) {
      return undefined;
    }

    return {
      effectIds: effectIds !== undefined ? [...effectIds] : undefined,
      emissiveColor: partial.emissive_color,
      emissiveIntensity: partial.emissive_intensity,
      postEffectOcclusion: partial.postEffectOcclusion,
    };
  }

  private getEffectOptions(): { keepClones: boolean } | undefined {
    return this.layerType === "cesium3dtiles"
      ? { keepClones: true }
      : undefined;
  }
}

type LayerEffectUpdatePayload = {
  effectIds?: string[];
  emissive_color?: number;
  emissive_intensity?: number;
  postEffectOcclusion?: boolean;
};

type StructuredCloneFn = <T>(value: T) => T;

const getStructuredClone = (): StructuredCloneFn | undefined => {
  const global = globalThis as typeof globalThis & {
    structuredClone?: StructuredCloneFn;
  };

  return typeof global.structuredClone === "function"
    ? global.structuredClone.bind(global)
    : undefined;
};

const structuredCloneFn = getStructuredClone();

const deepClone = <T>(value: T): T => {
  if (structuredCloneFn) {
    return structuredCloneFn(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const mergePlainObjects = (
  target: Record<string, unknown>,
  update: Record<string, unknown>,
): Record<string, unknown> => {
  for (const [key, value] of Object.entries(update)) {
    if (value === undefined) {
      continue;
    }

    if (isPlainObject(value)) {
      const existing = target[key];
      if (isPlainObject(existing)) {
        target[key] = mergePlainObjects(
          existing as Record<string, unknown>,
          value as Record<string, unknown>,
        );
      } else {
        target[key] = deepClone(value);
      }
      continue;
    }

    target[key] = deepClone(value);
  }

  return target;
};

const mergeLayerDescriptions = (
  base: LayerDescription | undefined,
  update: LayerDescription,
): LayerDescription => {
  if (!base) {
    return deepClone(update);
  }
  const baseClone = deepClone(base) as Record<string, unknown>;
  return mergePlainObjects(
    baseClone,
    update as unknown as Record<string, unknown>,
  ) as LayerDescription;
};

const cloneLayerDescription = (desc: LayerDescription): LayerDescription =>
  deepClone(desc);

const areArraysEqual = (next?: string[], prev?: string[]): boolean => {
  if (next === prev) return true;
  if (!next || !prev) return false;
  if (next.length !== prev.length) return false;
  return next.every((value, index) => value === prev[index]);
};
