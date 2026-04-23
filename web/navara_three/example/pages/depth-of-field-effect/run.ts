import ThreeView, { Color } from "@navara/three";
import {
  DepthOfFieldEffectDesc,
  DEFAULT_DEPTH_OF_FIELD_OPTIONS,
} from "@navara/three_default_descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import { TILE_DATASETS, TILES_3D_DATASETS } from "../../helpers/constants";
import {
  addHidePaneKeyShortcut,
  addDateControl,
  addCameraControl,
} from "../../helpers/control";

export type CustomDescriptions = DefaultDescriptions;

export const run = async (view: ThreeView<CustomDescriptions>) => {
  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  await view.init();

  const defaultAtmospheres = defaultPlugin.addDefaultPhotorealScene();
  defaultAtmospheres.sun.update({
    sun: {
      intensity: 1,
      castShadow: true,
    },
  });

  view.setCamera({
    lng: 139.7860717773,
    lat: 35.7012176514,
    height: 316.32,
    heading: 235.0817871094,
    pitch: -12.2630929947,
    roll: 0,
  });

  const depthOfFieldDefaults = DEFAULT_DEPTH_OF_FIELD_OPTIONS;

  const depthOfFieldLayer = view.addEffect<DepthOfFieldEffectDesc>({
    depthOfField: { ...depthOfFieldDefaults },
    visible: true,
  });

  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: {
      maxZoom: 23,
    },
  });

  view.addLayer({
    type: "cesium3dtiles",
    data: {
      url: TILES_3D_DATASETS.plateauChiyoda.url,
    },
    model: {
      show: true,
      color: new Color().setStyle("#ffffff"),
      metalness: 0.1,
      roughness: 0.1,
      castShadow: true,
      receiveShadow: true,
    },
  });

  const pane = new Pane({
    title: "Depth of Field Effect",
    expanded: true,
  });

  addHidePaneKeyShortcut(pane);

  const params = { ...depthOfFieldDefaults };

  pane
    .addBinding(params, "bokehScale", { min: 0.0, max: 10.0, step: 0.01 })
    .on("change", (ev) => {
      depthOfFieldLayer.update({ depthOfField: { bokehScale: ev.value } });
    });

  const coc = pane.addFolder({ title: "Circle of confusion", expanded: true });
  coc
    .addBinding(params, "focusDistance", { step: 0.0005 })
    .on("change", (ev) => {
      depthOfFieldLayer.update({ depthOfField: { focusDistance: ev.value } });
    });

  coc.addBinding(params, "focalLength", { step: 0.005 }).on("change", (ev) => {
    depthOfFieldLayer.update({ depthOfField: { focalLength: ev.value } });
  });

  pane.addButton({ title: "Reset" }).on("click", () => {
    Object.assign(params, depthOfFieldDefaults);
    pane.refresh();
    depthOfFieldLayer.update({ depthOfField: { ...depthOfFieldDefaults } });
  });

  addDateControl(view, pane);
  addCameraControl(view, pane);
  showAttributions([TILE_DATASETS.gsiSeamlessphoto]);
};
