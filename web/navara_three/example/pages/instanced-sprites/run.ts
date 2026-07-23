import ThreeView, { Color } from "@navaramap/three";
import { AmbientLightDesc } from "@navaramap/three_default_descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three_default_plugin";
import { Pane } from "tweakpane";

import { TILE_DATASETS, VECTOR_DATASETS } from "../../helpers/constants";
import { addCameraControl, addDateControl } from "../../helpers/control";
import { addCtrlPanel, type MaterialDesc } from "../../helpers/panel";

const layers: MaterialDesc[] = [
  {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { icon: "restaurant" },
          geometry: {
            coordinates: [139.70513431449842, 35.69279782617761],
            type: "Point",
          },
        },
        {
          type: "Feature",
          properties: { icon: "cafe" },
          geometry: {
            coordinates: [140.13033810546995, 35.60447056434825],
            type: "Point",
          },
        },
        {
          type: "Feature",
          properties: { icon: "hotel" },
          geometry: {
            coordinates: [139.64591330307843, 35.85950281451436],
            type: "Point",
          },
        },
        {
          type: "Feature",
          properties: { icon: "school" },
          geometry: {
            coordinates: [139.63564871528018, 35.44128807202607],
            type: "Point",
          },
        },
        {
          type: "Feature",
          properties: { icon: "hospital" },
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

export const run = async (view: ThreeView<DefaultDescriptions>) => {
  view.addPlugin(new DefaultPlugin());
  const attribution = view.attribution;

  await view.init();

  attribution?.add([
    VECTOR_DATASETS.gsiExperimentalVector,
    TILE_DATASETS.openstreetmap,
  ]);

  view.addLight<AmbientLightDesc>({
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

  const layerInstances = addCtrlPanel(layers, view, pane);
  addCameraControl(view, pane);
  addDateControl(view, pane);

  // Per-feature billboard images: each feature's `icon` property picks an
  // image URL. Every distinct URL is loaded once and packed into the layer's
  // texture atlas. `image: null` reverts to the material's `url`, so features
  // whose `icon` is removed fall back to the default instead of keeping a
  // stale override.
  const [billboardLayer] = layerInstances.values();
  billboardLayer?.on("featureUpdated", ({ evaluator }) => {
    evaluator.evaluate(
      ({ properties }) => {
        const icon = properties?.["icon"] as string | undefined;
        return { image: icon ? `/icons/${icon}.svg` : null };
      },
      { filters: ["icon"] },
    );
  });
};
