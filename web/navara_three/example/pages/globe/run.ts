import ThreeView, {
  Color,
  JAPAN_GSI_ELEVATION_DECODER,
} from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { Pane } from "tweakpane";

import {
  TERRAIN_DATASETS,
  TILE_DATASETS,
  TILES_3D_DATASETS,
} from "../../helpers/constants";
import { addCameraControl, addDateControl } from "../../helpers/control";
import { addFieldsToFolder, type FolderFields } from "../../helpers/panel";

export type CustomDescriptions = DefaultDescriptions;

export async function run() {
  const view = new ThreeView<CustomDescriptions>({});

  const plugin = new DefaultPlugin();
  view.addPlugin(plugin);

  const attribution = view.attribution;

  await view.init();

  view.toneMappingExposure = 10;

  // Add atmosphere descriptors
  const defaultEffects = plugin.addDefaultPhotorealScene();

  defaultEffects.sky.delete();
  defaultEffects.aerialPerspective.update({
    aerialPerspective: {
      sky: true,
    },
  });

  view.addEffect({
    clouds: {},
  });

  // Add terrain layer
  const terrainDem = view.addSource({
    type: "raster-dem",
    url: TERRAIN_DATASETS.gsi.url,
    elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    maxZoom: 15,
    minZoom: 6,
  });
  view.addLayer({
    type: "terrain",
    source: terrainDem,
    terrain: {
      skirt: false,
    },
  });

  view.addLayer({
    type: "raster",
    source: terrainDem,
    hillshade: {},
  });

  // Add tile layer
  const seamlessphoto = view.addSource({
    type: "raster-tile",
    url: TILE_DATASETS.gsiSeamlessphoto.url,
    maxZoom: 18,
  });
  view.addLayer({
    type: "raster",
    source: seamlessphoto,
    raster: {
      color: new Color().setStyle("#ffffff"),
      opacity: 1,
    },
  });

  const chiyodaSubwaySource = view.addSource({
    type: "3d-tiles",
    url: TILES_3D_DATASETS.ChiyodaSubway.url,
  });
  const chiyodaSubway = view.addLayer({
    type: "3d-tiles",
    source: chiyodaSubwaySource,
    model: {
      height: -50,
    },
  });

  let selectedGMLId: string | undefined;
  view.on("pick", (info) => {
    selectedGMLId = info?.properties?.["gml_id"] as string;
    chiyodaSubway.forceUpdate();
  });

  chiyodaSubway.on("featureUpdated", ({ evaluator }) => {
    evaluator.evaluate(
      ({ properties }) => {
        const gmlId = properties?.["gml_id"] as string;
        if (selectedGMLId === gmlId) {
          return {
            color: new Color().setHex(0xff00ff),
          };
        }
        return {
          color: new Color().setHex(0xffffff),
        };
      },
      { filters: ["gml_id"] },
    );
  });

  view.setCamera({
    lng: 139.7621830566,
    lat: 35.6776542664,
    height: 455.79,
    heading: 64.301940918,
    pitch: -35.9155464172,
    roll: 0,
  });

  const pane = new Pane();

  addCameraControl(view, pane);
  addDateControl(view, pane);
  addGlobeControl(view, pane);

  attribution?.add([
    TERRAIN_DATASETS.gsi,
    TILE_DATASETS.gsiSeamlessphoto,
    TILES_3D_DATASETS.ChiyodaSubway,
  ]);
}

const addGlobeControl = (view: ThreeView<CustomDescriptions>, pane: Pane) => {
  if (!view.globe) {
    console.warn("Globe API not available");
    return;
  }

  const globe = view.globe;

  const colorValue = globe.color ? globe.color.toHex() : 0x9481ad; // Default color

  const PARAMS = {
    color: "#" + colorValue.toString(16).padStart(6, "0"),
    hideUnderground: globe.hideUnderground,
    transparent: true,
    opacity: 0.5,
    wireframe: globe.wireframe,
  };

  globe.transparent = PARAMS.transparent;
  globe.opacity = PARAMS.opacity;

  const fields: FolderFields<typeof PARAMS> = [
    {
      name: "color",
      params: {
        color: { type: "int" },
      },
      onChange: (v) => {
        if (globe) {
          globe.color = new Color().setStyle(v.value);
        }
      },
    },
    {
      name: "hideUnderground",
      onChange: (v) => {
        if (globe) {
          globe.hideUnderground = v.value;
        }
      },
    },
    {
      name: "transparent",
      onChange: (v) => {
        if (globe) {
          globe.transparent = v.value;
        }
      },
    },
    {
      name: "opacity",
      params: {
        min: 0,
        max: 1,
        step: 0.01,
      },
      onChange: (v) => {
        if (globe) {
          globe.opacity = v.value;
        }
      },
    },
    {
      name: "wireframe",
      onChange: (v) => {
        if (globe) {
          globe.wireframe = v.value;
        }
      },
    },
  ];

  addFieldsToFolder(
    pane.addFolder({ title: "Globe Configuration" }),
    PARAMS,
    fields,
  );
};
