import ThreeView, {
  Color,
  degreeToRadian,
  geodeticToVector3,
  northUpEastToFixedFrame,
} from "@navaramap/three";
import type {
  BoxMeshDesc,
  CylinderMeshDesc,
  SphereMeshDesc,
  TubeMeshDesc,
} from "@navaramap/three_default_descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three_default_plugin";
import { TileJsonPlugin } from "@navaramap/three_plugins";

import { addButton } from "../../../../helpers/button";
import { initializeExample } from "../../../../helpers/initialize";

// Quiet mountain stage shared with the Layers example.
const STAGE = { lng: 137.6495, lat: 36.2445 };

const view = new ThreeView<DefaultDescriptions>();

initializeExample(view);

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);
const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

// Fixed afternoon sun + ambient fill so each mesh gets distinct shading.
view.atmosphere.date = new Date("2026-07-16T03:00:00Z");
view.addLight({ ambient: { intensity: 0.6 } });
view.addLight({ sun: { intensity: 1.8 } });

view.setCamera({
  lng: 137.6495,
  lat: 36.2382,
  height: 400,
  heading: 0,
  pitch: -26,
  roll: 0,
});

const basemap = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/styles/grayscale/tilejson.json",
});
view.addLayer({ type: "raster", source: basemap });

// Mesh transforms are ECEF by default; a tangent frame at the target
// coordinate turns position/rotation/scale into local offsets (x north,
// y up, z east).
const frame = northUpEastToFixedFrame(
  geodeticToVector3({
    lng: degreeToRadian(STAGE.lng),
    lat: degreeToRadian(STAGE.lat),
    height: 0,
  }),
);

// One row of meshes, spread along the east axis with the same spacing as the
// Layers example's exhibits. Primitives are centered on their origin, so each
// is lifted to sit on the ground.
const SPACING = 240;
const rowZ = (index: number) => (index - 1.5) * SPACING;

const addMeshes = (color: string) => {
  const accent = () => new Color().setStyle(color);
  const box = view.addMesh<BoxMeshDesc>({
    box: { width: 100, height: 150, depth: 100, color: accent() },
    matrixWorld: frame,
    position: { x: 0, y: 75, z: rowZ(0) },
  });
  const sphere = view.addMesh<SphereMeshDesc>({
    sphere: { radius: 65, color: accent() },
    matrixWorld: frame,
    position: { x: 0, y: 65, z: rowZ(1) },
  });
  const cylinder = view.addMesh<CylinderMeshDesc>({
    cylinder: { radiusTop: 50, radiusBottom: 50, height: 150, color: accent() },
    matrixWorld: frame,
    position: { x: 0, y: 75, z: rowZ(2) },
  });
  const tube = view.addMesh<TubeMeshDesc>({
    tube: {
      points: [
        { x: -60, y: -60, z: 0 },
        { x: -30, y: 60, z: 30 },
        { x: 30, y: -30, z: -30 },
        { x: 60, y: 60, z: 0 },
      ],
      radius: 15,
      tubularSegments: 64,
      radialSegments: 12,
      color: accent(),
    },
    matrixWorld: frame,
    position: { x: 0, y: 75, z: rowZ(3) },
  });
  return { box, sphere, cylinder, tube };
};

let color = "#0091ff";
let meshes: ReturnType<typeof addMeshes> | undefined = addMeshes(color);

const toggleButton = addButton("Remove meshes");
const styleButton = addButton("Switch color");

toggleButton.onclick = () => {
  if (meshes) {
    Object.values(meshes).forEach((mesh) => mesh.delete());
    view.forceUpdate(); // repaint the on-demand scene
    meshes = undefined;
  } else {
    meshes = addMeshes(color);
  }
  toggleButton.textContent = meshes ? "Remove meshes" : "Add meshes";
  styleButton.disabled = !meshes;
};

styleButton.onclick = () => {
  if (!meshes) return;
  color = color === "#0091ff" ? "#ff6b2c" : "#0091ff";
  const accent = new Color().setStyle(color);
  // The textured GLTF car keeps its own materials; only the primitives are
  // restyled.
  meshes.box.update({ box: { color: accent } });
  meshes.sphere.update({ sphere: { color: accent } });
  meshes.cylinder.update({ cylinder: { color: accent } });
  meshes.tube.update({ tube: { color: accent } });
};
