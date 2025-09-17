import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  CloudsEffectLayer,
  type ArclineMeshLayer,
} from "@navara/three";
import { Vector3 } from "three";
import { Pane } from "tweakpane";

import { TERRAIN_URLS, TILE_URLS } from "../../helpers/constants";
import { addCameraControl, addDateControl } from "../../helpers/control";

const gArcLinesDef = [
  {
    // Asia
    thickness: 2,
    segments: 64,
    height: 0,
    arcHeightScale: 0.3,
    srcColor: 0xffffff,
    tgtColor: Math.floor(Math.random() * 0xffffff),
    geometry: [
      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: 126.44, lat: 37.4633 }, // ICN

      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: 121.232, lat: 25.0775 }, // TPE

      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: 113.9185, lat: 22.308 }, // HKG

      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: 103.994, lat: 1.354 }, // SIN

      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: 55.3644, lat: 25.2528 }, // DXB

      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: 72.8777, lat: 19.0896 }, // BOM

      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: 77.1025, lat: 28.5562 }, // DEL
    ],
  },
  {
    // Oceania
    srcColor: 0xffffff,
    tgtColor: Math.floor(Math.random() * 0xffffff),
    geometry: [
      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: 151.1772, lat: -33.9461 }, // SYD

      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: 151.837, lat: -27.3842 }, // BNE

      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: 144.8433, lat: -37.669 }, // MEL
    ],
  },
  {
    // Europe
    srcColor: 0xffffff,
    tgtColor: Math.floor(Math.random() * 0xffffff),
    geometry: [
      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: -0.4543, lat: 51.4706 }, // LHR

      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: 2.55, lat: 49.0128 }, // CDG

      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: 37.9063, lat: 55.9726 }, // SVO
    ],
  },
  {
    // North America
    srcColor: 0xffffff,
    tgtColor: Math.floor(Math.random() * 0xffffff),
    geometry: [
      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: -118.4085, lat: 33.9416 }, // LAX

      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: -122.375, lat: 37.6188 }, // SFO

      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: -74.0059, lat: 40.6413 }, // JFK
    ],
  },
  {
    // South America
    srcColor: 0xffffff,
    tgtColor: Math.floor(Math.random() * 0xffffff),
    geometry: [
      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: -46.4731, lat: -23.4356 }, // GRU

      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: -58.4173, lat: -34.8222 }, // EZE

      { lng: 139.75711454748298, lat: 35.67564356091717 },
      { lng: -43.2506, lat: -22.809 }, // GIG
    ],
  },
];

export const run = async (view: ThreeView) => {
  await view.init();

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

  // For debug
  // const defaultEffects = view.addDefaultEffectLayers();
  // defaultEffects.aerialPerspective.update({
  //   aerialPerspective: {
  //     irradiance: true,
  //   },
  // });

  view.addDefaultAtmosphereLayers();

  view.addLayer<CloudsEffectLayer>({
    type: "effect",
    clouds: {},
  });
  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });

  addCameraControl(view, pane);
  addDateControl(view, pane);

  addArcLines(view, pane);
};

function intToHexColor(num: number) {
  return "#" + num.toString(16).padStart(6, "0");
}

const addArcLines = (view: ThreeView, pane: Pane) => {
  const arcLineLayer = view.addLayer<ArclineMeshLayer>({
    type: "mesh",
    arcLines: gArcLinesDef,
  });

  // Create arc line group names
  const arcLineNames = [
    "Asia",
    "Oceania",
    "Europe",
    "North America",
    "South America",
  ];

  const params = {
    selectedGroup: 0,
    thickness: gArcLinesDef[0].thickness || 1,
    segments: gArcLinesDef[0].segments || 64,
    srcColor: intToHexColor(gArcLinesDef[0].srcColor || 0xffffff),
    tgtColor: intToHexColor(gArcLinesDef[0].tgtColor || 0xffffff),
    height: gArcLinesDef[0].height || 0,
    arcHeightScale: gArcLinesDef[0].arcHeightScale || 0.3,
  };

  const updateParams = (index: number) => {
    const selectedArcLine = gArcLinesDef[index];
    if (selectedArcLine) {
      params.thickness = selectedArcLine.thickness || 1;
      params.segments = selectedArcLine.segments || 64;
      params.srcColor = intToHexColor(selectedArcLine.srcColor || 0xffffff);
      params.tgtColor = intToHexColor(selectedArcLine.tgtColor || 0xffffff);
      params.height = selectedArcLine.height || 0;
      params.arcHeightScale = selectedArcLine.arcHeightScale || 0.3;
    }
  };

  const onChange = () => {
    const selectedIndex = params.selectedGroup;
    if (gArcLinesDef[selectedIndex]) {
      gArcLinesDef[selectedIndex].thickness = params.thickness;
      gArcLinesDef[selectedIndex].segments = params.segments;
      gArcLinesDef[selectedIndex].srcColor = parseInt(
        params.srcColor.replace("#", ""),
        16,
      );
      gArcLinesDef[selectedIndex].tgtColor = parseInt(
        params.tgtColor.replace("#", ""),
        16,
      );
      gArcLinesDef[selectedIndex].height = params.height;
      gArcLinesDef[selectedIndex].arcHeightScale = params.arcHeightScale;
      arcLineLayer.update({ arcLines: gArcLinesDef });
    }
  };

  const folder = pane.addFolder({
    title: "ArcLine",
  });

  // Add dropdown for selecting arc line group
  folder
    .addBinding(params, "selectedGroup", {
      view: "list",
      label: "Arc Group",
      options: arcLineNames
        .map((name, index) => ({ text: name, value: index }))
        .filter((_, index) => index < gArcLinesDef.length), // Only show groups that exist
    })
    .on("change", () => {
      updateParams(params.selectedGroup);
      folder.refresh(); // Refresh to update all parameter displays
    });

  folder
    .addBinding(params, "thickness", { min: 0.1, max: 10, step: 0.1 })
    .on("change", () => {
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
