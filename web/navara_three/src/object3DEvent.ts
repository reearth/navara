import type { Event, Object3DEventMap } from "three";

export type LayerEffectsChangedEventData = {
  effects: string[];
  emissiveIntensity: number;
  layerId: string;
  prevEffects: string[];
};

export type LayerEffectsChangedEvent = Event & LayerEffectsChangedEventData;

export type EmissiveEventData = {
  emissiveIntensity: number;
  emissiveColor?: number;
  layerId: string;
};

export type EmissiveEvent = Event & EmissiveEventData;

export type SelectiveDepthTestChangedEventData = {
  selectiveDepthTest: boolean;
  layerId: string;
};

export type SelectiveDepthTestChangedEvent = Event &
  SelectiveDepthTestChangedEventData;

export type CustomObject3DEventMap = Object3DEventMap & {
  removedFromWorld: undefined;
  needsUpdate: undefined;
  layerEffectsChanged: LayerEffectsChangedEvent;
  emissive: EmissiveEvent;
  selectiveDepthTestChanged: SelectiveDepthTestChangedEvent;
};

export type CustomObject3DEvent =
  | LayerEffectsChangedEvent
  | EmissiveEvent
  | SelectiveDepthTestChangedEvent;

export function isEmissiveEvent(event: unknown): event is EmissiveEvent {
  return (
    typeof event === "object" &&
    event !== null &&
    "type" in event &&
    (event as { type?: string }).type === "emissive" &&
    typeof (event as Partial<EmissiveEventData>).emissiveIntensity === "number"
  );
}

export function isLayerEffectsChangedEvent(
  event: unknown,
): event is LayerEffectsChangedEvent {
  return (
    typeof event === "object" &&
    event !== null &&
    "type" in event &&
    (event as { type?: string }).type === "layerEffectsChanged" &&
    Array.isArray(
      (event as Partial<LayerEffectsChangedEventData>).effects ?? null,
    )
  );
}

export function isSelectiveDepthTestChangedEvent(
  event: unknown,
): event is SelectiveDepthTestChangedEvent {
  return (
    typeof event === "object" &&
    event !== null &&
    "type" in event &&
    (event as { type?: string }).type === "selectiveDepthTestChanged" &&
    typeof (event as Partial<SelectiveDepthTestChangedEventData>)
      .selectiveDepthTest === "boolean"
  );
}
