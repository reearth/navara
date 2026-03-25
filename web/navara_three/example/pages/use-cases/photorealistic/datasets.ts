import type { Dataset } from "../../../helpers/constants";
import {
  TILE_DATASETS,
  TERRAIN_DATASETS,
  VECTOR_DATASETS,
  LOCAL_DATASETS,
} from "../../../helpers/constants";

export { FONT_DATASETS } from "../../../helpers/constants";

/**
 * Central bundle of all data layers used in the photorealistic example.
 *
 * This allows us to:
 * - Reuse the same dataset references across files (layers, panels, etc.)
 * - Generate consistent attributions from a single source of truth
 */
export const UC_PHOTOREALISTIC_DATASETS = {
  // Base raster imagery (photo)
  baseRaster: TILE_DATASETS.gsiSeamlessphoto,

  // Terrain / DEM
  terrain: TERRAIN_DATASETS.gsi,

  // 3D Tiles / Buildings
  buildings3DTilesSaitamaSakura: {
    url: "https://assets.cms.plateau.reearth.io/assets/2a/695ff5-0bb1-4e7f-8a4e-7c301e58b753/11100_saitama-shi_city_2024_citygml_1_op_bldg_3dtiles_11106_sakura-ku_lod1/tileset.json",
    attribution:
      "3D City Model (Project PLATEAU) Saitama City (FY2023) Sakura Ward - MLIT PLATEAU",
    attributionUrl:
      "https://www.geospatial.jp/ckan/dataset/plateau-11100-saitama-shi-2023",
  },
  buildings3DTilesSaitamaWest: {
    url: "https://assets.cms.plateau.reearth.io/assets/14/896375-2974-4623-b02a-fa7a71a78a70/11100_saitama-shi_city_2024_citygml_1_op_bldg_3dtiles_11101_nishi-ku_lod1/tileset.json",
    attribution:
      "3D City Model (Project PLATEAU) Saitama City (FY2023) Nishi Ward - MLIT PLATEAU",
    attributionUrl:
      "https://www.geospatial.jp/ckan/dataset/plateau-11100-saitama-shi-2023",
  },
  buildings3DTilesSaitamaNorth: {
    url: "https://assets.cms.plateau.reearth.io/assets/e4/174d24-0479-4b7b-8302-053f3d2e4411/11100_saitama-shi_city_2024_citygml_1_op_bldg_3dtiles_11102_kita-ku_lod1/tileset.json",
    attribution:
      "3D City Model (Project PLATEAU) Saitama City (FY2023) Kita Ward - MLIT PLATEAU",
    attributionUrl:
      "https://www.geospatial.jp/ckan/dataset/plateau-11100-saitama-shi-2023",
  },
  buildings3DTilesSaitamaSouth: {
    url: "https://assets.cms.plateau.reearth.io/assets/1f/51ec0d-44bf-424f-9b44-05cdfdfa5de3/11100_saitama-shi_city_2024_citygml_1_op_bldg_3dtiles_11108_minami-ku_lod1/tileset.json",
    attribution:
      "3D City Model (Project PLATEAU) Saitama City (FY2023) Minami Ward - MLIT PLATEAU",
    attributionUrl:
      "https://www.geospatial.jp/ckan/dataset/plateau-11100-saitama-shi-2023",
  },
  buildings3DTilesSaitamaCenter: {
    url: "https://assets.cms.plateau.reearth.io/assets/a0/935444-8044-4cda-9b82-cee922e1d80a/11100_saitama-shi_city_2024_citygml_1_op_bldg_3dtiles_11105_chuo-ku_lod1/tileset.json",
    attribution:
      "3D City Model (Project PLATEAU) Saitama City (FY2023) Chuo Ward - MLIT PLATEAU",
    attributionUrl:
      "https://www.geospatial.jp/ckan/dataset/plateau-11100-saitama-shi-2023",
  },
  buildings3DTilesSaitamaOmiya: {
    url: "https://assets.cms.plateau.reearth.io/assets/4d/3051ba-5c06-476d-afba-7fcb44e422c6/11100_saitama-shi_city_2024_citygml_1_op_bldg_3dtiles_11103_omiya-ku_lod1/tileset.json",
    attribution:
      "3D City Model (Project PLATEAU) Saitama City (FY2023) Omiya Ward - MLIT PLATEAU",
    attributionUrl:
      "https://www.geospatial.jp/ckan/dataset/plateau-11100-saitama-shi-2023",
  },
  buildings3DTilesSaitamaUrawa: {
    url: "https://assets.cms.plateau.reearth.io/assets/a4/a34b26-be50-4cc3-acf3-1996d0227f0c/11100_saitama-shi_city_2024_citygml_1_op_bldg_3dtiles_11107_urawa-ku_lod1/tileset.json",
    attribution:
      "3D City Model (Project PLATEAU) Saitama City (FY2023) Urawa Ward - MLIT PLATEAU",
    attributionUrl:
      "https://www.geospatial.jp/ckan/dataset/plateau-11100-saitama-shi-2023",
  },

  // Experimental vector (used for water polygon styling)
  waterMvt: VECTOR_DATASETS.gsiExperimentalVector,

  // Local overlay (clouds texture)
  cloudsOverlay: LOCAL_DATASETS.blueMarbleClouds,

  // Scenario data (CZML)
  floodCzml: {
    url: "https://assets.cms.plateau.reearth.io/assets/c3/2822c1-a99f-46d0-9d73-766b685e2126/11100_saitama-shi_city_2024_flood-simulation_saitama-BP002.czml",
    attribution:
      "PLATEAU 3D Visualization of Time-Series Flood Simulation by Levee Break Point (Arakawa River System)",
    attributionUrl: "https://www.mlit.go.jp/plateau/use-case/uc22-026/",
  } satisfies Dataset,

  // Shelter points (source GeoJSON on PLATEAU CMS)
  shelterGeojson: {
    url: "https://assets.cms.plateau.reearth.io/assets/be/fef5a2-d6a0-4c03-b7b1-0c86ffcecde0/11100_saitama-shi_city_2024_shelter.geojson",
    attribution:
      "PLATEAU Shelter Facility Data (Saitama City 2024) Converted to MVT",
    attributionUrl:
      "https://www.geospatial.jp/ckan/dataset/plateau-11100-saitama-shi-2023",
  } satisfies Dataset,
} as const;

/**
 * Convenience list of datasets that should appear in attribution UIs.
 * Keep this list in sync with the layers actually used in this scene.
 */
export const UC_PHOTOREALISTIC_ATTRIBUTION_DATASETS: readonly Dataset[] = [
  UC_PHOTOREALISTIC_DATASETS.baseRaster,
  UC_PHOTOREALISTIC_DATASETS.terrain,
  UC_PHOTOREALISTIC_DATASETS.buildings3DTilesSaitamaSakura,
  UC_PHOTOREALISTIC_DATASETS.buildings3DTilesSaitamaWest,
  UC_PHOTOREALISTIC_DATASETS.buildings3DTilesSaitamaNorth,
  UC_PHOTOREALISTIC_DATASETS.buildings3DTilesSaitamaSouth,
  UC_PHOTOREALISTIC_DATASETS.buildings3DTilesSaitamaCenter,
  UC_PHOTOREALISTIC_DATASETS.buildings3DTilesSaitamaOmiya,
  UC_PHOTOREALISTIC_DATASETS.waterMvt,
  UC_PHOTOREALISTIC_DATASETS.cloudsOverlay,
  UC_PHOTOREALISTIC_DATASETS.shelterGeojson,
  UC_PHOTOREALISTIC_DATASETS.floodCzml,
];

export const BUILDING_DATASETS = [
  {
    ...UC_PHOTOREALISTIC_DATASETS.buildings3DTilesSaitamaSakura,
    heightOffset: -45,
    heightDomain: { min: 3, max: 46 },
    label: {
      en: "Sakura Ward",
      ja: "桜区",
    },
    initial: true,
  },
  {
    ...UC_PHOTOREALISTIC_DATASETS.buildings3DTilesSaitamaWest,
    heightOffset: -45,
    heightDomain: { min: 3, max: 41.4 },
    label: {
      en: "West Ward",
      ja: "西区",
    },
    initial: true,
  },
  {
    ...UC_PHOTOREALISTIC_DATASETS.buildings3DTilesSaitamaNorth,
    heightOffset: -45,
    heightDomain: { min: 3, max: 59 },
    label: {
      en: "North Ward",
      ja: "北区",
    },
    initial: false,
  },
  {
    ...UC_PHOTOREALISTIC_DATASETS.buildings3DTilesSaitamaSouth,
    heightOffset: -45,
    heightDomain: { min: 3, max: 121.2 },
    label: {
      en: "South Ward",
      ja: "南区",
    },
    initial: false,
  },
  {
    ...UC_PHOTOREALISTIC_DATASETS.buildings3DTilesSaitamaCenter,
    heightOffset: -45,
    heightDomain: { min: 3, max: 207.9 },
    label: {
      en: "Center Ward",
      ja: "中央区",
    },
    initial: false,
  },
  {
    ...UC_PHOTOREALISTIC_DATASETS.buildings3DTilesSaitamaOmiya,
    heightOffset: -45,
    heightDomain: { min: 3, max: 139.1 },
    label: {
      en: "Omiya Ward",
      ja: "大宮区",
    },
    initial: false,
  },
  {
    ...UC_PHOTOREALISTIC_DATASETS.buildings3DTilesSaitamaUrawa,
    heightOffset: -45,
    heightDomain: { min: 3, max: 107.8 },
    label: {
      en: "Urawa Ward",
      ja: "浦和区",
    },
    initial: false,
  },
] as const;

export type PhotorealisticDatasets = typeof UC_PHOTOREALISTIC_DATASETS;
