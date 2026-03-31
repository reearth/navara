import ThreeView, { Color } from "@navara/three";
import { AmbientLightLayer } from "@navara/three_default_layers";
import {
  DefaultPlugin,
  type DefaultLayerDescriptions,
} from "@navara/three_default_plugin";
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
    billboard: {
      color: new Color().setStyle("#ffffff"),
      size: 10000,
      height: 1,
      sizeInMeters: true,
      clampToGround: true,
      depthTest: true,
      alphaTest: 0.5,
      center: { x: 0.0, y: -0.5 },
      transparent: true,
      url: "/example.png",
      offsetDepth: true,
    },
  },
  {
    type: "mvt",
    data: {
      url: VECTOR_DATASETS.gsiExperimentalVector.url,
    },
    point: {
      size: 10000,
      sizeInMeters: true,
      clampToGround: true,
      color: new Color().setStyle("#991f3d"),
      center: { x: 0.0, y: 0.0 },
      height: 1,
      offsetDepth: true,
      depthTest: true,
      transparent: true,
    },
    vectorTile: {
      maxZoom: 6,
    },
  },
];

export const run = async (view: ThreeView<DefaultLayerDescriptions>) => {
  view.addPlugin(new DefaultPlugin());

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
