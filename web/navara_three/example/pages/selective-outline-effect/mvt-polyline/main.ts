import ThreeView, { Color, JAPAN_GSI_ELEVATION_DECODER } from "@navara/three";

import { showAttributions } from "../../../helpers/attributions";
import {
  MVT_DATASETS,
  TERRAIN_DATASETS,
  TILE_DATASETS,
} from "../../../helpers/constants";

const run = async () => {
  const view = new ThreeView({ debug: true, shadow: true });
  await view.init();

  const atmospheres = view.addDefaultAtmosphereLayers();
  atmospheres.sun.update({
    sun: { intensity: 1, castShadow: true },
  });

  view.atmosphere.date.setHours(8);

  // Camera position for Gifu
  view.setCamera({
    lng: 136.76,
    lat: 35.39,
    height: 3000,
    heading: 0,
    pitch: -45,
    roll: 0,
  });

  // Selective outline effect
  const outlineEffect = view.addLayer({
    type: "effect",
    selectiveOutline: {
      color: new Color().setHex(0xff0000),
      thickness: 2.0,
      edgeStrength: 1.0,
    },
  });

  view.addDefaultEffectLayers();

  // MVT polyline with outline (Gifu roads)
  const layer = view.addLayer({
    type: "mvt",
    data: { url: MVT_DATASETS.plateauGifuTran.url },
    polyline: {
      width: 5,
      height: 10,
      clampToGround: true,
      useGroundNormals: true,
      effectIds: [outlineEffect.id],
      emissiveIntensity: 0.5,
      selectiveEffectOcclusion: "normal",
    },
    vectorTile: { maxZoom: 16 },
  });

  layer.on("featureUpdated", ({ evaluator }) => {
    evaluator.evaluate((_batchId, property) => {
      const rawAttributes = property?.["attributes"];
      const attrs =
        typeof rawAttributes === "string" ? JSON.parse(rawAttributes) : {};
      const generics = attrs["gen:genericAttribute"] as unknown[];

      const treeInfo = generics?.find(
        (g) =>
          g && typeof g === "object" && "name" in g && g.name === "樹木の有無",
      ) as { value: { value: string }[] } | undefined;

      const code = treeInfo?.value[0]?.value;

      const color = (() => {
        if (code === "1") return new Color().setHex(0x00ccff);
        return new Color().setHex(0x777777);
      })();

      return { color };
    });
  });

  // Base layers
  view.addLayer({
    type: "terrain",
    data: { url: TERRAIN_DATASETS.gsi.url },
    rasterTerrain: {
      maxZoom: 15,
      minZoom: 5,
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
      castShadow: true,
      receiveShadow: true,
    },
  });

  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: { maxZoom: 23 },
  });

  showAttributions([
    TILE_DATASETS.openstreetmap,
    TERRAIN_DATASETS.gsi,
    MVT_DATASETS.plateauGifuTran,
  ]);
};

run();
