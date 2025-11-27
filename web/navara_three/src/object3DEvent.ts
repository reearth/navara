import type { Event, Object3DEventMap } from "three";

export type LayerEffectsChangedEventData = {
  effectIds: string[];
  emissiveIntensity: number;
  layerId: string;
  prevEffectIds: string[];
};

export type LayerEffectsChangedEvent = Event & LayerEffectsChangedEventData;

export type EmissiveEventData = {
  emissiveIntensity: number;
  emissiveColor?: number;
  layerId: string;
};

export type EmissiveEvent = Event & EmissiveEventData;

export type PostEffectDepthTestChangedEventData = {
  postEffectDepthTest: boolean;
  layerId: string;
};

export type PostEffectDepthTestChangedEvent = Event &
  PostEffectDepthTestChangedEventData;

export type CustomObject3DEventMap = Object3DEventMap & {
  removedFromWorld: undefined;
  needsUpdate: undefined;
  layerEffectsChanged: LayerEffectsChangedEvent;
  emissive: EmissiveEvent;
  postEffectDepthTestChanged: PostEffectDepthTestChangedEvent;
};

export type CustomObject3DEvent =
  | LayerEffectsChangedEvent
  | EmissiveEvent
  | PostEffectDepthTestChangedEvent;

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
      (event as Partial<LayerEffectsChangedEventData>).effectIds ?? null,
    )
  );
}

export function isPostEffectDepthTestChangedEvent(
  event: unknown,
): event is PostEffectDepthTestChangedEvent {
  return (
    typeof event === "object" &&
    event !== null &&
    "type" in event &&
    (event as { type?: string }).type === "postEffectDepthTestChanged" &&
    typeof (event as Partial<PostEffectDepthTestChangedEventData>)
      .postEffectDepthTest === "boolean"
  );
}
