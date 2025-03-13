import ThreeView from "@navara/three";

import { TILE_URLS } from "../../helpers/constants";
import { addCtrlPanel } from "../../helpers/panel";

export const run = async (view: ThreeView) => {
  await view.init();

  addCtrlPanel(
    [
      {
        type: "tiles",
        data: { url: TILE_URLS.openstreetmap },
        raster_tile: {
          color: 0xffffff,
          max_zoom: 23,
          opacity: 1,
        },
      },
      {
        type: "tiles",
        data: { url: TILE_URLS.gsiStd },
        raster_tile: {
          color: 0xffffff,
          max_zoom: 18,
          opacity: 1,
        },
      },
      {
        type: "tiles",
        data: { url: TILE_URLS.gsiSeamlessphoto },
        raster_tile: {
          color: 0xffffff,
          max_zoom: 18,
          opacity: 1,
        },
      },
    ],
    view,
  );
};
