import type { Event, Object3DEventMap } from "three";

export type LayerEffectsChangedEventData = {
  effectIds: string[];
  emissiveIntensity: number;
  emissiveColor?: number;
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

export type PostEffectOcclusionChangedEventData = {
  postEffectOcclusion: number; // 0 = DepthEnabled, 2 = Silhouette
  layerId: string;
};

export type PostEffectOcclusionChangedEvent = Event &
  PostEffectOcclusionChangedEventData;

export type CustomObject3DEventMap = Object3DEventMap & {
  removedFromWorld: undefined;
  needsUpdate: undefined;
  layerEffectsChanged: LayerEffectsChangedEvent;
  emissive: EmissiveEvent;
  postEffectOcclusionChanged: PostEffectOcclusionChangedEvent;
};

export type CustomObject3DEvent =
  | LayerEffectsChangedEvent
  | EmissiveEvent
  | PostEffectOcclusionChangedEvent;

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

export function isPostEffectOcclusionChangedEvent(
  event: unknown,
): event is PostEffectOcclusionChangedEvent {
  return (
    typeof event === "object" &&
    event !== null &&
    "type" in event &&
    (event as { type?: string }).type === "postEffectOcclusionChanged" &&
    typeof (event as Partial<PostEffectOcclusionChangedEventData>)
      .postEffectOcclusion === "number"
  );
}
