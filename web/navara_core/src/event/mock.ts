import type {
  EntityEvent,
  Events,
  RenderableFeatureAddedEvent,
  RenderableFeatureChangedEvent,
} from "@navaramap/engine";
import { noop } from "lodash-es";

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
  return { ind, gen, free: noop } as Ev;
};

// The real `Events` exposes each stack only via a `take_<key>()` method
// (see EventManager.pushEvents); mimic that shape for any key.
export const makeEvent = (events: { [K in JsEventsKey]?: JsEvents[K] }) =>
  new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (typeof prop === "string" && prop.startsWith("take_")) {
          return () => events[prop.slice("take_".length) as JsEventsKey];
        }
        return undefined;
      },
    },
  ) as Events;
