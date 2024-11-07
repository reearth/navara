import type {
  EntityEvent,
  Events,
  RenderableFeatureAddedEvent,
  RenderableFeatureChangedEvent,
} from "navara";

import type { JsEvents, JsEventsKey } from "./EventManager";

export const makeRenderableFeatures = <
  Ev extends
    | RenderableFeatureAddedEvent
    | RenderableFeatureChangedEvent
    | EntityEvent,
>(
  ind: number,
  gen: number,
) => {
  return { ind, gen } as Ev;
};

export const makeEvent = (events: { [K in JsEventsKey]?: JsEvents[K] }) => {
  const e = {};
  for (const key_ of Object.keys(events)) {
    const key = key_ as JsEventsKey;
    const event = events[key] as JsEvents[JsEventsKey];
    Object.assign(e, { [key]: event });
  }
  return e as Events;
};
