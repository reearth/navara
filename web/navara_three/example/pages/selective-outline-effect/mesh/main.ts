import ThreeView, { Color, JAPAN_GSI_ELEVATION_DECODER, geodeticToVector3, degreeToRadian } from "@navara/three";
import { DefaultPlugin, type DefaultLayerDescriptions } from "@navara/three_default_plugin";
import { Vector3 } from "three";

import { showAttributions } from "../../../helpers/attributions";
import { TERRAIN_DATASETS, TILE_DATASETS } from "../../../helpers/constants";

const run = async () => {
  const view = new ThreeView<DefaultLayerDescriptions>({ debug: true, shadow: true });
  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);
  await view.init();

  const defaultAtmospheres = defaultPlugin.addDefaultPhotorealLayers();
  defaultAtmospheres.sun.update({
    sun: { intensity: 1, castShadow: true },
  });
  view.atmosphere.date.setHours(8);

  view.setCamera({
    lng: 139.767125,
    lat: 35.676,
    height: 800,
    heading: 0,
    pitch: -45,
    roll: 0,
  });

  // Effect Layer
  const outlineEffect = view.addLayer({
    type: "effect",
    selectiveOutline: true,
    selectiveEffectOcclusion: "normal",
    outlineColor: new Color().setHex(0x00ff00),
    outlineThickness: 2.0,
    outlineEdgeStrength: 1.0,
  });

  // Box (red, emissive) at Tokyo Station
  const boxPosition = geodeticToVector3({
    lat: degreeToRadian(35.6812),
    lng: degreeToRadian(139.7671),
    height: 200,
  });
  view.addLayer({
    type: "mesh",
    box: {
      width: 100,
      height: 100,
      depth: 100,
      color: new Color().setHex(0xff0000),
      emissiveColor: new Color().setHex(0xff0000),
      emissiveIntensity: 1.0,
      effectIds: [outlineEffect.id],
    },
    position: { x: boxPosition.x, y: boxPosition.y, z: boxPosition.z },
  });

  // Sphere (blue, emissive) near Tokyo Station
  const spherePosition = new Vector3(boxPosition.x, boxPosition.y, boxPosition.z).add(new Vector3(-500, 0, -600));
  view.addLayer({
    type: "mesh",
    sphere: {
      radius: 80,
      color: new Color().setHex(0x0000ff),
      emissiveColor: new Color().setHex(0x0000ff),
      emissiveIntensity: 1.0,
      effectIds: [outlineEffect.id],
    },
    position: { x: spherePosition.x, y: spherePosition.y, z: spherePosition.z },
  });

  // Base layers
  view.addLayer({
    type: "terrain",
    data: { url: TERRAIN_DATASETS.gsi.url },
    rasterTerrain: {
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
      maxZoom: 15,
    },
  });
  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.gsiSeamlessphoto.url },
    rasterTile: { maxZoom: 18 },
  });

  showAttributions([TERRAIN_DATASETS.gsi, TILE_DATASETS.gsiSeamlessphoto]);
};

run();
