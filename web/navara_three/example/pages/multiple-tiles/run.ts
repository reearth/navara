import ThreeView, { Color } from "@navara/three";

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
        rasterTile: {
          color: new Color().setStyle("#ffffff"),
          maxZoom: 23,
          opacity: 1,
        },
      },
      {
        type: "tiles",
        data: { url: TILE_DATASETS.gsiStd.url },
        rasterTile: {
          color: new Color().setStyle("#ffffff"),
          maxZoom: 18,
          opacity: 1,
        },
      },
      {
        type: "tiles",
        data: { url: TILE_DATASETS.gsiSeamlessphoto.url },
        rasterTile: {
          color: new Color().setStyle("#ffffff"),
          maxZoom: 18,
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
