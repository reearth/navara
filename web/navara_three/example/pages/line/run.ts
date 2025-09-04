import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  type ArclineMeshLayer,
} from "@navara/three";

import { Vector3 } from "three";

import { Pane } from "tweakpane";

import { TERRAIN_URLS, TILE_URLS } from "../../helpers/constants";
import { addCameraControl, addDateControl } from "../../helpers/control";

const gGeometryDef = [
  { lng: 139.75711454748298, lat: 35.67564356091717 },
  { lng: 126.44, lat: 37.4633 }, // ICN

  { lng: 139.75711454748298, lat: 35.67564356091717 },
  { lng: 121.232, lat: 25.0775 }, // TPE

  { lng: 139.75711454748298, lat: 35.67564356091717 },
  { lng: 113.9185, lat: 22.308 }, // HKG

  { lng: 139.75711454748298, lat: 35.67564356091717 },
  { lng: 103.994, lat: 1.354 }, // SIN

  { lng: 139.75711454748298, lat: 35.67564356091717 },
  { lng: 151.1772, lat: -33.9461 }, // SYD

  { lng: 139.75711454748298, lat: 35.67564356091717 },
  { lng: -0.4543, lat: 51.4706 }, // LHR

  { lng: 139.75711454748298, lat: 35.67564356091717 },
  { lng: 2.55, lat: 49.0128 }, // CDG

  { lng: 139.75711454748298, lat: 35.67564356091717 },
  { lng: -118.4085, lat: 33.9416 }, // LAX

  { lng: 139.75711454748298, lat: 35.67564356091717 },
  { lng: -122.375, lat: 37.6188 }, // SFO

  { lng: 139.75711454748298, lat: 35.67564356091717 },
  { lng: -74.0059, lat: 40.6413 }, // JFK

  { lng: 139.75711454748298, lat: 35.67564356091717 },
  { lng: -46.4731, lat: -23.4356 }, // GRU

  { lng: 139.75711454748298, lat: 35.67564356091717 },
  { lng: -58.4173, lat: -34.8222 }, // EZE

  { lng: 139.75711454748298, lat: 35.67564356091717 },
  { lng: -43.2506, lat: -22.809 }, // GIG

  { lng: 139.75711454748298, lat: 35.67564356091717 },
  { lng: 151.837, lat: -27.3842 }, // BNE

  { lng: 139.75711454748298, lat: 35.67564356091717 },
  { lng: 144.8433, lat: -37.669 }, // MEL

  { lng: 139.75711454748298, lat: 35.67564356091717 },
  { lng: 55.3644, lat: 25.2528 }, // DXB

  { lng: 139.75711454748298, lat: 35.67564356091717 },
  { lng: 72.8777, lat: 19.0896 }, // BOM

  { lng: 139.75711454748298, lat: 35.67564356091717 },
  { lng: 77.1025, lat: 28.5562 }, // DEL

  { lng: 139.75711454748298, lat: 35.67564356091717 },
  { lng: 37.9063, lat: 55.9726 }, // SVO
];

export const run = async (view: ThreeView) => {
  await view.init();

  view.addDefaultAtmosphereLayers();

  view.addLayer({
    type: "terrain",
    data: {
      url: TERRAIN_URLS.gsi,
    },
    raster_terrain: {
      max_zoom: 15,
      min_zoom: 5,
      elevation_decoder: JAPAN_GSI_ELEVATION_DECODER(),
    },
  });

  view.addLayer({
    type: "tiles",
    data: {
      url: TILE_URLS.openstreetmap,
    },
    raster_tile: {},
  });

  view.addLayer({
    type: "mesh",
    axesHelper: {
      size: 5,
    },
    scale: new Vector3().setScalar(1e9),
  });

  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });

  addCameraControl(view, pane);
  addDateControl(view, pane);

  addArcLines(view, pane);
};

const addArcLines = (view: ThreeView, pane: Pane) => {
  const params = {
    thickness: 1,
    opacity: 1,
    segments: 64,
    srcColor: "#00ff00",
    tgtColor: "#ff0000",
    height: 10000,
    arcHeightScale: 0.3,
  };

  const arcLineLayer = view.addLayer<ArclineMeshLayer>({
    type: "mesh",
    arcLine: {
      thickness: params.thickness,
      opacity: params.opacity,
      segments: params.segments,
      srcColor: parseInt(params.srcColor.replace("#", ""), 16),
      tgtColor: parseInt(params.tgtColor.replace("#", ""), 16),
      height: params.height,
      geometry: gGeometryDef,
    },
  });

  const onChange = () => {
    arcLineLayer.update({
      arcLine: {
        thickness: params.thickness,
        opacity: params.opacity,
        segments: params.segments,
        srcColor: parseInt(params.srcColor.replace("#", ""), 16),
        tgtColor: parseInt(params.tgtColor.replace("#", ""), 16),
        height: params.height,
        arcHeightScale: params.arcHeightScale,
      },
    });
  };

  const folder = pane.addFolder({
    title: "ArcLine",
  });

  folder
    .addBinding(params, "thickness", { min: 0.1, max: 10, step: 0.1 })
    .on("change", () => {
      onChange();
    });

  folder.addBinding(params, "opacity", { min: 0, max: 1 }).on("change", () => {
    onChange();
  });

  folder
    .addBinding(params, "segments", { min: 2, max: 128, step: 1 })
    .on("change", () => {
      onChange();
    });

  folder.addBinding(params, "srcColor").on("change", () => {
    onChange();
  });

  folder.addBinding(params, "tgtColor").on("change", () => {
    onChange();
  });

  folder.addBinding(params, "height").on("change", () => {
    onChange();
  });

  folder
    .addBinding(params, "arcHeightScale", { min: 0, max: 1, step: 0.01 })
    .on("change", () => {
      onChange();
    });
};
