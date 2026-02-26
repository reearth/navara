import ThreeView, { AmbientLightLayer, Color } from "@navara/three";
import { Pane } from "tweakpane";

import { TILE_DATASETS, VECTOR_DATASETS } from "../../helpers/constants";
import { addCameraControl, addDateControl } from "../../helpers/control";
import {
  addCtrlPanel,
  type MaterialLayerDescription,
} from "../../helpers/panel";

const layers: MaterialLayerDescription[] = [
  {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            coordinates: [139.70513431449842, 35.69279782617761],
            type: "Point",
          },
        },
        {
          type: "Feature",
          properties: {},
          geometry: {
            coordinates: [140.13033810546995, 35.60447056434825],
            type: "Point",
          },
        },
        {
          type: "Feature",
          properties: {},
          geometry: {
            coordinates: [139.64591330307843, 35.85950281451436],
            type: "Point",
          },
        },
        {
          type: "Feature",
          properties: {},
          geometry: {
            coordinates: [139.63564871528018, 35.44128807202607],
            type: "Point",
          },
        },
        {
          type: "Feature",
          properties: {},
          geometry: {
            coordinates: [139.28453080888477, 35.51560883529815],
            type: "Point",
          },
        },
      ],
    },
    text: {
      color: new Color().setStyle("#ffffff"),
      height: 1,
      scaleByDistance: true,
      clampToGround: true,
      depthTest: true,
      text: "hello world!!!",
      font: "https://raw.githubusercontent.com/loveencounterflow/jizura-fonts/master/fonts/Roboto/Roboto-Black.ttf",
      size: 50,
      center: { x: 0.5, y: 0, },
    },
  },
  {
    type: "mvt",
    data: {
      url: VECTOR_DATASETS.gsiExperimentalVector.url,
    },
    text: {
      color: new Color().setStyle("#ffffff"),
      height: 1,
      scaleByDistance: true,
      clampToGround: true,
      depthTest: true,
      text: "hello world/こんにちは世界!!!, this is a very long text to test the rendering of instanced SDF text mesh in Navara Three.",
      // font: "https://raw.githubusercontent.com/loveencounterflow/jizura-fonts/master/fonts/Roboto/Roboto-Black.ttf",
      // text: "hello 京都!!!",
      // font: "https://raw.githubusercontent.com/blagarde/midori/master/fonts-japanese-gothic.ttf",
      font: "https://raw.githubusercontent.com/loveencounterflow/jizura-fonts/master/fonts/fonts-japanese-mincho.ttf",
      size: 50,
      center: { x: 0.5, y: 0, },
    },
    vectorTile: {
      maxZoom: 4,
    },
  },
];

export const run = async (view: ThreeView) => {
  await view.init();

  view.addLayer<AmbientLightLayer>({
    type: "light",
    ambient: {
      intensity: 0.5,
    },
  });

  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: {
      maxZoom: 23,
    },
  });

  view.setCamera({
    lng: 133.4791459306,
    lat: 32.8411214823,
    height: 320413.04,
    heading: 50.2271850895,
    pitch: -39.5339635139,
    roll: 360,
  });

  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });

  addCtrlPanel(layers, view, pane);
  addCameraControl(view, pane);
  addDateControl(view, pane);
};
