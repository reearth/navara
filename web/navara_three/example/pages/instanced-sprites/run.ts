import ThreeView, {
  AmbientLightLayer,
  Color,
} from "@navara/three";
import { Pane } from "tweakpane";

import { TILE_DATASETS, VECTOR_DATASETS } from "../../helpers/constants";
import { addCameraControl, addDateControl } from "../../helpers/control";
import { addCtrlPanel, type MaterialLayerDescription } from "../../helpers/panel";


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
      scaleByDistance: false,
      clampToGround: true,
      depthTest: true,
      alphaTest: .5,
      center: { x: 1.0, y: -1.0 },
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
      scaleByDistance: false,
      clampToGround: true,
      color: new Color().setStyle("#991f3d"),
      center: { x: 1.0, y: -1.0 },
      height: 1,
      offsetDepth: true,
      depthTest: true,
      transparent: true,
    },
    vectorTile: {
      maxZoom: 4,
    },
  }
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

  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });

  addCtrlPanel(layers, view, pane);
  addCameraControl(view, pane);
  addDateControl(view, pane);
};