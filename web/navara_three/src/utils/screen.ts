import type { Nullable, XYZ } from "@navara/core";
import { convertScreenToWorld } from "@navara/three_api";
import { Vector2 } from "three";

import type ThreeView from "../index";

export const convertScreenPos = (
  view: ThreeView,
  x: number,
  y: number,
): Nullable<XYZ> => {
  if (!view.camera) {
    console.error("View camera is not initialized.");
    return;
  }

  const screenSize = view.screenSize;
  const pixelRatio = view.pixelRatio;

  const win = { width: screenSize.x, height: screenSize.y, pixel_ratio: pixelRatio };

  const pos = convertScreenToWorld(win, view.camera.raw, new Vector2(x, y));

  return pos;
};
