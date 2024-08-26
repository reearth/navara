import ThreeView from "@navara/three";

import { run } from "./run";

export type Message =
  | {
      type: "init";
      canvas: OffscreenCanvas;
      width: number;
      height: number;
      pixelRatio?: number;
    }
  | {
      type: "resize";
      width: number;
      height: number;
    }
  | {
      type: "dispose";
    };

export type Event = {
  type: "init";
};

let view: ThreeView | undefined;

self.onmessage = async (event: MessageEvent<Message>) => {
  switch (event.data.type) {
    case "init":
      view = new ThreeView({
        canvas: event.data.canvas,
        initialWidth: event.data.width,
        initialHeight: event.data.height,
        initialPixelRatio: event.data.pixelRatio,
        debug: true,
      });
      await run(view).then(r => {
        self.postMessage({ type: "init" } satisfies Event);
        return r;
      });
      break;
    case "resize":
      if (!view) return;
      view.resize(event.data.width, event.data.height);
      break;
    case "dispose":
      if (!view) return;
      view.dispose();
      break;
  }
};
