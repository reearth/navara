import ThreeView from "@navara/three";
import type { AttributionPlugin } from "@navara/three_plugins";

import { run, type CustomDescriptions, type TerrainType } from "./run";

let currentView: ThreeView<CustomDescriptions> | undefined;
let currentAttribution: AttributionPlugin | undefined;

const switchTerrain = async (terrainType: TerrainType): Promise<void> => {
  // ThreeView.dispose() does not dispose plugins, so release the attribution
  // plugin explicitly or its DOM and global keydown listener leak per switch.
  currentAttribution?.dispose();
  currentView?.dispose();
  currentView = new ThreeView<CustomDescriptions>({
    shadow: true,
    debug: true,
  });
  currentAttribution = await run(currentView, terrainType, switchTerrain);
};

switchTerrain("reearth");
