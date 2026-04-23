import ThreeView, {
  Color,
  JAPAN_GSI_ELEVATION_DECODER,
  degreeToRadian,
  northUpEastToFixedFrame,
  geodeticToVector3,
} from "@navara/three";
import type {
  BoxMeshDesc,
  CylinderMeshDesc,
} from "@navara/three_default_descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import { TERRAIN_DATASETS, TILE_DATASETS } from "../../helpers/constants";
import { addDateControl } from "../../helpers/control";

const run = async () => {
  const view = new ThreeView<DefaultDescriptions>({
    debug: true,
    shadow: true,
  });

  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  await view.init();

  const defaultAtmospheres = defaultPlugin.addDefaultPhotorealScene();
  defaultAtmospheres.sun.update({
    sun: { intensity: 2, castShadow: true, shadowFar: 5000 },
  });

  view.addLight({
    ambient: { intensity: 0.5 },
  });

  view.setCamera({
    lng: 138.7306518555,
    lat: 35.285277832,
    height: 15000,
    heading: 0,
    pitch: -60,
    roll: 0,
  });

  // Base layers
  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: { maxZoom: 18 },
  });

  view.addLayer({
    type: "terrain",
    data: { url: TERRAIN_DATASETS.gsi.url },
    rasterTerrain: {
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
      maxZoom: 15,
      castShadow: true,
      receiveShadow: true,
    },
  });

  view.addLayer({
    type: "tiles",
    data: { url: TERRAIN_DATASETS.gsi.url },
    rasterTile: { maxZoom: 18 },
    hillshade: {
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    },
  });

  // Positions & ENU matrices around Mt. Fuji
  const boxPosition = geodeticToVector3({
    lat: degreeToRadian(35.365),
    lng: degreeToRadian(138.735),
    height: 100,
  });
  const boxMatrixWorld = northUpEastToFixedFrame(boxPosition);

  // Box mesh descriptor
  const boxLayer = view.addMesh<BoxMeshDesc>({
    box: {
      width: 1000,
      height: 10000,
      depth: 1000,
      color: new Color().setHex(0xff4444),
      opacity: 0.8,
      transparent: true,
      castShadow: true,
      receiveShadow: true,
      draped: true,
    },
    matrixWorld: boxMatrixWorld,
  });

  const cylinderPosition = geodeticToVector3({
    lat: degreeToRadian(35.355),
    lng: degreeToRadian(138.72),
    height: 100,
  });
  const cylinderMatrixWorld = northUpEastToFixedFrame(cylinderPosition);

  // Cylinder mesh descriptor
  const cylinderLayer = view.addMesh<CylinderMeshDesc>({
    cylinder: {
      radiusTop: 500,
      radiusBottom: 500,
      height: 10000,
      radialSegments: 32,
      color: new Color().setHex(0x4488ff),
      opacity: 0.8,
      transparent: true,
      castShadow: true,
      receiveShadow: true,
      draped: true,
    },
    matrixWorld: cylinderMatrixWorld,
  });

  // Control panel
  const pane = new Pane({ title: "Draped Meshes" });
  addDateControl(view, pane);

  const boxParams = { draped: true };
  const cylinderParams = { draped: true };

  const boxFolder = pane.addFolder({ title: "Box" });
  boxFolder.addBinding(boxParams, "draped").on("change", ({ value }) => {
    boxLayer.update({ box: { draped: value } });
  });

  const cylinderFolder = pane.addFolder({ title: "Cylinder" });
  cylinderFolder
    .addBinding(cylinderParams, "draped")
    .on("change", ({ value }) => {
      cylinderLayer.update({ cylinder: { draped: value } });
    });

  showAttributions([TILE_DATASETS.openstreetmap, TERRAIN_DATASETS.gsi]);
};

run();
