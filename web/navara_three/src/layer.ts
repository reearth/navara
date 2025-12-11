import { EventHandler, type FeatureId } from "@navara/core";
import type { Core } from "@navara/engine";

import type { ViewContext } from "./core";
import { FeatureEvaluator } from "./evaluations";
import { applyEffectPayloadToObject } from "./event/featureEvent";
import type { LayerDescription } from "./type";

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
    // Pass through to Core - effects will be applied via RenderableFeatureChanged event
    const merged = this.mergeDescription(l);
    this.core.updateLayer(this.id, merged);
  }

  delete() {
    this.core.deleteLayer(this.id);
    this.emit("deleted");
  }

  getLayerType(): string | undefined {
    return this.layerType;
  }

  private mergeDescription(update: LayerDescription): LayerDescription {
    this.cachedDescription = mergeLayerDescriptions(
      this.cachedDescription,
      update,
    );
    return this.cachedDescription;
  }
}

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
