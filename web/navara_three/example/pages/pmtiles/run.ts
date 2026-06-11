import ThreeView, { Color } from "@navara/three";
import { ToneMappingMode } from "@navara/three_default_descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import { SphericalHarmonics3 } from "three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import { PMTILES_DATASETS } from "../../helpers/constants";
import { SH_COEFFICIENTS } from "../../helpers/sh";

export type CustomDescriptions = DefaultDescriptions;

export const run = async (view: ThreeView<CustomDescriptions>) => {
  view.addPlugin(new DefaultPlugin());

  await view.init();

  view.addLight({ ambient: {} });
  view.toneMappingExposure = 3;
  view.addEffect({ toneMapping: { mode: ToneMappingMode.REINHARD2 } });
  view.addEffect({ smaa: {} });
  view.addLight({
    lightProbe: {
      sh: new SphericalHarmonics3().set(SH_COEFFICIENTS.white),
      intensity: 1,
    },
  });

  // The sample archive covers Florence, Italy.
  view.setCamera({
    lng: 11.2558,
    lat: 43.7696,
    height: 9000,
    heading: 0,
    pitch: -90,
    roll: 0,
  });

  // A plain ellipsoid surface to drape the clamp-to-ground vectors onto (this
  // example has no terrain/raster base of its own).
  view.addLayer({ type: "terrain", ellipsoid: {} });

  const url = PMTILES_DATASETS.protomapsFirenze.url;

  // Every layer below shares the same `.pmtiles` archive URL, so they all
  // resolve through a single PmtilesSource (one header/directory fetch, shared
  // tile cache). The `vectorTile.layers` filter picks which MVT layer each one
  // styles — identical to how the MVT example works.
  // `land` is the base fill, so it goes first; water / land_use / infrastructure
  // drape on top of it.
  view.addLayer({
    type: "mvt",
    data: { url },
    polygon: {
      color: new Color().setStyle("#d0bf70"),
      clampToGround: true,
    },
    vectorTile: { maxZoom: 15, layers: ["earth"] },
  });

  view.addLayer({
    type: "mvt",
    data: { url },
    polyline: {
      show: true,
      color: new Color().setStyle("#b4aa15"),
      width: 2,
      height: 1,
      clampToGround: true,
    },
    vectorTile: { maxZoom: 15, layers: ["boundaries"] },
  });

  view.addLayer({
    type: "mvt",
    data: { url },
    polygon: {
      color: new Color().setStyle("#4a90d9"),
      clampToGround: true,
    },
    vectorTile: { maxZoom: 15, layers: ["water"] },
  });

  view.addLayer({
    type: "mvt",
    data: { url },
    polyline: {
      show: true,
      color: new Color().setStyle("#278b8c"),
      width: 6,
      height: 1,
      clampToGround: true,
    },
    vectorTile: { maxZoom: 15, layers: ["roads"] },
  });

  view.addLayer({
    type: "mvt",
    data: { url },
    polygon: {
      color: new Color().setStyle("#ca7c56"),
      clampToGround: true,
    },
    vectorTile: { maxZoom: 15, layers: ["buildings"] },
  });

  const pane = new Pane();

  pane
    .addButton({
      title: "reset camera",
    })
    .on("click", () => {
      view.setCamera({
        lng: 11.2558,
        lat: 43.7696,
        height: 9000,
        heading: 0,
        pitch: -90,
        roll: 0,
      });
    });

  showAttributions([PMTILES_DATASETS.protomapsFirenze]);
};
