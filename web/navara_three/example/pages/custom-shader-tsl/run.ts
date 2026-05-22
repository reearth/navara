import ThreeView, {
  Color,
  degreeToRadian,
  geodeticToVector3,
  JAPAN_GSI_ELEVATION_DECODER,
  northUpEastToFixedFrame,
} from "@navara/three";
import type { BoxMeshDesc } from "@navara/three_default_descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import { color, mix, sin, time, uv, vec3 } from "three/tsl";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import { TERRAIN_DATASETS, TILE_DATASETS } from "../../helpers/constants";
import { addCameraControl, addDateControl } from "../../helpers/control";

export type CustomDescriptions = DefaultDescriptions;

export const run = async (view: ThreeView<CustomDescriptions>) => {
  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  await view.init();

  const defaultAtmospheres = defaultPlugin.addDefaultPhotorealScene();
  defaultAtmospheres.sun.update({
    sun: { intensity: 1, castShadow: true },
  });
  view.atmosphere.date.setHours(10);

  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: { maxZoom: 23 },
  });
  view.addLayer({
    type: "terrain",
    data: {
      url: TERRAIN_DATASETS.gsi.url,
    },
    rasterTerrain: {
      maxZoom: 15,
      minZoom: 6,
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
      castShadow: true,
      receiveShadow: true,
    },
  });
  view.addLayer({
    type: "tiles",
    data: {
      url: TERRAIN_DATASETS.gsi.url,
    },
    rasterTile: {
      maxZoom: 15,
      minZoom: 6,
    },
    hillshade: {
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    },
  });

  // ------------------------------------------------------------------
  // TSL color customization: UV-based gradient with sin(time) blending.
  // The colorNode replaces the Lambert material's diffuse color lookup
  // while normal-based lighting, MRT outputs, and shadow handling are
  // still provided by setupNodeMaterialForMRT under the hood.
  // ------------------------------------------------------------------
  const animatedColorNode = mix(
    color(0xff3366),
    color(0x33ccff),
    sin(time.mul(1.6)).mul(0.5).add(0.5),
  ).mul(mix(vec3(0.6), vec3(1.0), uv().y));

  const origin = geodeticToVector3({
    lat: degreeToRadian(35.681236),
    lng: degreeToRadian(139.767125),
    height: 0,
  });
  const frame = northUpEastToFixedFrame(origin);

  // 1) BoxMesh with a custom TSL colorNode.
  view.addMesh<BoxMeshDesc>({
    matrixWorld: frame,
    position: { x: -300, y: 150, z: 0 },
    box: {
      width: 200,
      height: 200,
      depth: 200,
      colorNode: animatedColorNode,
      castShadow: true,
      receiveShadow: true,
    },
  });

  // 2) BoxMesh participating in selective bloom — verifies the TSL MRT
  // emissive / effectId outputs are wired correctly.
  const bloomEffect = view.addEffect({
    selectiveBloom: { strength: 1.2, radius: 0.6, threshold: 0.0 },
  });

  view.addMesh<BoxMeshDesc>({
    matrixWorld: frame,
    position: { x: 0, y: 150, z: 0 },
    box: {
      width: 200,
      height: 200,
      depth: 200,
      color: new Color().setHex(0xff8800),
      emissiveColor: new Color().setHex(0xff8800),
      emissiveIntensity: 1.5,
      castShadow: true,
      receiveShadow: true,
      effectIds: [bloomEffect.id],
    },
  });

  // 3) BoxMesh that is pickable — verifies the TSL picking color override.
  const pickableLayer = view.addMesh<BoxMeshDesc>({
    matrixWorld: frame,
    position: { x: 300, y: 150, z: 0 },
    pickable: true,
    box: {
      width: 200,
      height: 200,
      depth: 200,
      color: new Color().setHex(0x44ff66),
      castShadow: true,
      receiveShadow: true,
    },
  });

  view.setCamera({
    lng: 139.767125,
    lat: 35.679,
    height: 1200,
    heading: 0,
    pitch: -40,
    roll: 0,
  });

  // UI: report whether the pickable cube was hit.
  const pane = new Pane({ title: "Custom Shader (TSL)" });
  const info = { picked: "(none)" };
  const picked = pane.addBinding(info, "picked", {
    readonly: true,
    label: "pick",
  });

  view.on("pick", (pickInfo) => {
    const batchId = pickInfo?.batchId;
    info.picked =
      batchId != null && batchId === pickableLayer.ref.batchId
        ? `Box (batchId=${batchId})`
        : "(none)";
    picked.refresh();
  });

  addDateControl(view, pane);
  addCameraControl(view, pane);

  showAttributions([TILE_DATASETS.openstreetmap]);
};
