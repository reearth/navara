import ThreeView, { Color } from "@navara/three";
import { AttributionPlugin } from "@navara/three_plugins";

import { datasetToSource } from "../../helpers/attribution-source";
import { TILE_DATASETS } from "../../helpers/constants";
import { addCtrlPanel } from "../../helpers/panel";

export const run = async (view: ThreeView) => {
  const attribution = new AttributionPlugin();
  view.addPlugin(attribution);

  await view.init();

  view.globe.useNormal = false;

  view.addLayer({
    type: "terrain",
    ellipsoid: {},
  });

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

  attribution.show([
    datasetToSource(TILE_DATASETS.openstreetmap),
    datasetToSource(TILE_DATASETS.gsiStd),
    datasetToSource(TILE_DATASETS.gsiSeamlessphoto),
  ]);
};
