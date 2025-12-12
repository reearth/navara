import ThreeView, { Color, JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import {
  TERRAIN_DATASETS,
  TILE_DATASETS,
  TILES_3D_DATASETS,
} from "../../helpers/constants";
import { addCameraControl, addDateControl } from "../../helpers/control";
import { addFieldsToFolder, type FolderFields } from "../../helpers/panel";

export async function run() {
  const view = new ThreeView({});

  await view.init();

  view.toneMappingExposure = 10;

  // Add atmosphere layers
  const defaultAtmosphere = view.addDefaultAtmosphereLayers();
  const defaultEffects = view.addDefaultEffectLayers();

  defaultAtmosphere.sky.delete();
  defaultEffects.aerialPerspective.update({
    aerialPerspective: {
      sky: true,
    },
  });

  view.addLayer({
    type: "effect",
    clouds: {},
  });

  // Add terrain layer
  view.addLayer({
    type: "terrain",
    data: {
      url: TERRAIN_DATASETS.gsi.url,
    },
    rasterTerrain: {
      maxZoom: 15,
      minZoom: 6,
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
      skirt: false,
    },
  });

  // Add tile layer
  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.gsiSeamlessphoto.url },
    rasterTile: {
      color: new Color().setStyle("#ffffff"),
      maxZoom: 18,
      opacity: 1,
    },
  });

  const chiyodaSubway = view.addLayer({
    type: "cesium3dtiles",
    data: {
      url: TILES_3D_DATASETS.ChiyodaSubway.url,
    },
    model: {
      height: -50,
    },
  });

  let selectedGMLId: string | undefined;
  view.on("pick", (info) => {
    selectedGMLId = info?.properties?.get("gml_id") as string;
    chiyodaSubway.forceUpdate();
  });

  chiyodaSubway.on("featureUpdated", (evaluator) => {
    evaluator.evaluate((_batchId, properties) => {
      const gmlId = properties?.get("gml_id") as string;
      if (selectedGMLId === gmlId) {
        return {
          color: new Color().setHex(0xff00ff),
        };
      }
      return {
        color: new Color().setHex(0xffffff),
      };
    });
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

  showAttributions([
    TERRAIN_DATASETS.gsi,
    TILE_DATASETS.gsiSeamlessphoto,
    TILES_3D_DATASETS.ChiyodaSubway,
  ]);
}

const addGlobeControl = (view: ThreeView, pane: Pane) => {
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
