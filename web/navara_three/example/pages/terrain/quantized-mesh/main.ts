import ThreeView from "@navara/three";

import { run, type CustomDescriptions, type TerrainType } from "./run";

let currentView: ThreeView<CustomDescriptions> | undefined;

const switchTerrain = async (terrainType: TerrainType): Promise<void> => {
  currentView?.dispose();
  currentView = new ThreeView<CustomDescriptions>({
    shadow: true,
    debug: true,
  });
  await run(currentView, terrainType, switchTerrain);
};

switchTerrain("reearth");
