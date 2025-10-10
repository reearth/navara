import ThreeView from "@navara/three";

import { showAttributions } from "../../helpers/attributions";
import { TILE_DATASETS } from "../../helpers/constants";
import { addCtrlPanel } from "../../helpers/panel";

export const run = async (view: ThreeView) => {
  await view.init();

  view.addDefaultAtmosphereLayers();

  addCtrlPanel(
    [
      {
        type: "tiles",
        data: { url: TILE_DATASETS.openstreetmap.url },
        raster_tile: {
          color: 0xffffff,
          max_zoom: 23,
          opacity: 1,
        },
      },
      {
        type: "tiles",
        data: { url: TILE_DATASETS.gsiStd.url },
        raster_tile: {
          color: 0xffffff,
          max_zoom: 18,
          opacity: 1,
        },
      },
      {
        type: "tiles",
        data: { url: TILE_DATASETS.gsiSeamlessphoto.url },
        raster_tile: {
          color: 0xffffff,
          max_zoom: 18,
          opacity: 1,
        },
      },
    ],
    view,
  );

  showAttributions([
    TILE_DATASETS.openstreetmap,
    TILE_DATASETS.gsiStd,
    TILE_DATASETS.gsiSeamlessphoto,
  ]);
};
