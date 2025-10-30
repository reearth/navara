/**
 * Dataset type definition
 */
export type Dataset = {
  url: string;
  attribution?: string;
  attributionUrl?: string;
};

/**
 * Raster tile datasets
 */
export const TILE_DATASETS = {
  openstreetmap: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
    attributionUrl: "https://www.openstreetmap.org/copyright",
  },
  gsiStd: {
    url: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
    attribution: "国土地理院タイル 標準地図",
    attributionUrl: "https://maps.gsi.go.jp/development/ichiran.html",
  },
  gsiSeamlessphoto: {
    url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
    attribution: "国土地理院タイル 全国最新写真（シームレス）",
    attributionUrl: "https://maps.gsi.go.jp/development/ichiran.html",
  },
} satisfies Record<string, Dataset>;

/**
 * Terrain/DEM datasets
 */
export const TERRAIN_DATASETS = {
  gsi: {
    url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
    attribution: "国土地理院タイル デジタル標高地形図",
    attributionUrl: "https://maps.gsi.go.jp/development/ichiran.html",
  },
  mapbox: {
    url: `https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=${
      import.meta.env.NAVARA_MAPBOX_ACCESS_TOKEN
    }`,
    attribution: "© Mapbox Terrain-RGB",
    attributionUrl:
      "https://docs.mapbox.com/data/tilesets/reference/mapbox-terrain-rgb-v1/",
  },
} satisfies Record<string, Dataset>;

/**
 * Vector tile datasets
 */
export const VECTOR_DATASETS = {
  gsiExperimentalVector: {
    url: "https://cyberjapandata.gsi.go.jp/xyz/experimental_bvmap/{z}/{x}/{y}.pbf",
    attribution: "国土地理院ベクトルタイル提供実験",
    attributionUrl:
      "https://github.com/gsi-cyberjapan/gsimaps-vector-experiment",
  },
} satisfies Record<string, Dataset>;

/**
 * 3D Tiles datasets (PLATEAU)
 */
export const TILES_3D_DATASETS = {
  plateauChiyoda: {
    url: "https://assets.cms.plateau.reearth.io/assets/db/070026-aa27-431b-8d53-7cc6b03244f8/13101_chiyoda-ku_pref_2023_citygml_1_op_bldg_3dtiles_13101_chiyoda-ku_lod2_no_texture/tileset.json",
    attribution:
      "3D都市モデル（Project PLATEAU）千代田区（2023年度） - 国土交通省 PLATEAU",
    attributionUrl:
      "https://www.geospatial.jp/ckan/dataset/plateau-13101-chiyoda-ku-2023",
  },
  plateauShinjuku: {
    url: "https://assets.cms.plateau.reearth.io/assets/f0/840fc4-114c-41e4-9a65-67768efd3629/13104_shinjuku-ku_pref_2023_citygml_2_op_bldg_3dtiles_13104_shinjuku-ku_lod2_no_texture/tileset.json",
    attribution:
      "3D都市モデル（Project PLATEAU）新宿区（2023年度） - 国土交通省 PLATEAU",
    attributionUrl:
      "https://www.geospatial.jp/ckan/dataset/plateau-13104-shinjuku-ku-2023",
  },
  plateauChiyodaB3DM: {
    url: "https://assets.cms.plateau.reearth.io/assets/23/bf39db-cd61-4e07-9be3-065a13ddf432/13101_chiyoda-ku_pref_2023_citygml_1_op_bldg_3dtiles_13101_chiyoda-ku_lod2/data/data500.b3dm",
    attribution:
      "3D都市モデル（Project PLATEAU）千代田区（2023年度） - 国土交通省 PLATEAU",
    attributionUrl:
      "https://www.geospatial.jp/ckan/dataset/plateau-13101-chiyoda-ku-2023",
  },
  plateauChuo: {
    url: "https://assets.cms.plateau.reearth.io/assets/4c/f2436a-e2be-40e2-83da-f1781f36e30b/13102_chuo-ku_pref_2023_citygml_1_op_bldg_3dtiles_13102_chuo-ku_lod2_no_texture/tileset.json",
    attribution:
      "3D都市モデル（Project PLATEAU）中央区（2023年度) - 国土交通省 PLATEAU",
    attributionUrl:
      "https://www.geospatial.jp/ckan/dataset/plateau-13102-chuo-ku-2023",
  },
  plateauTakanawa: {
    url: "https://assets.cms.plateau.reearth.io/assets/c1/28f9ff-e9d0-44df-b092-88ac7ebdfa42/tngw_4gaiku/tileset.json",
    attribution:
      "【uc23-11】ストーリーテリング型GISを用いたエリアマネジメントの高度化 - 国土交通省 PLATEAU",
    attributionUrl: "https://www.geospatial.jp/ckan/dataset/plateau-uc23-11",
  },
  plateauTokyoFlood: {
    url: "https://assets.cms.plateau.reearth.io/assets/bc/d3b4bd-77dd-428f-9ab9-9d77546a702b/13_tokyo-to_pref_2023_citygml_1_op_fld_pref_sumidagaw-shingashigawa-ryuiki_3dtiles_l2_no_texture/tileset.json",
    attribution:
      "3D都市モデル（Project PLATEAU）品川区（2023年度） - 国土交通省 PLATEAU",
    attributionUrl:
      "https://www.geospatial.jp/ckan/dataset/plateau-13109-shinagawa-ku-2023",
  },
  plateauKakegawaCastle: {
    url: "https://assets.cms.plateau.reearth.io/assets/6b/68c785-f43d-4451-ba7f-d4d130ef6ba5/uc_pv1_22213_kakegawa/pointcloud/22213_kakegawa_castle/tileset.json",
    attribution: "kakegawa castle point cloud model - 国土交通省 PLATEAU",
    attributionUrl: "https://www.geospatial.jp/ckan/dataset/kakegawacastle",
  },
  YamanashiKyonaka: {
    url: "https://yamanashi-tile.geospatial.jp/tile/2024/01_kyouchu/tileset.json",
    attribution: "Yamanashi Prefecture point cloud data - Kyonaka",
    attributionUrl:
      "https://www.geospatial.jp/ckan/dataset/yamanashi-pointcloud-2024",
  },
} satisfies Record<string, Dataset>;

/**
 * MVT (Mapbox Vector Tiles) datasets (PLATEAU)
 */
export const MVT_DATASETS = {
  plateauWakayamaGen: {
    url: "https://assets.cms.plateau.reearth.io/assets/d4/ee889d-98b4-4425-a5b6-c60bf36e2e5a/30201_wakayama-shi_city_2023_citygml_1_op_gen_20_mvt_lod0/{z}/{x}/{y}.mvt",
    attribution:
      "3D都市モデル（Project PLATEAU）和歌山市（2023年度） - 国土交通省 PLATEAU",
    attributionUrl:
      "https://www.geospatial.jp/ckan/dataset/plateau-30201-wakayama-shi-2023",
  },
  plateauGifuTran: {
    url: "https://assets.cms.plateau.reearth.io/assets/67/b5b3c6-71d8-405c-88c8-4ead72890b2b/21201_gifu-shi_city_2023_citygml_1_op_tran_mvt_lod0/{z}/{x}/{y}.mvt",
    attribution:
      "3D都市モデル（Project PLATEAU）岐阜市（2023年度） - 国土交通省 PLATEAU",
    attributionUrl:
      "https://www.geospatial.jp/ckan/dataset/plateau-21201-gifu-shi-2023",
  },
  plateauTokyoFirePrevention: {
    url: "https://assets.cms.plateau.reearth.io/assets/d9/5ce2d6-0aa8-4a17-a86a-028c2dc2b817/13_tokyo_pref_2023_citygml_1_op_urf_FirePreventionDistrict_mvt_lod1/{z}/{x}/{y}.mvt",
    attribution:
      "3D都市モデル（Project PLATEAU）東京都23区 - 国土交通省 PLATEAU",
    attributionUrl: "https://www.geospatial.jp/ckan/dataset/plateau-tokyo23ku",
  },
  plateauTokyoHeightControl: {
    url: "https://assets.cms.plateau.reearth.io/assets/a2/81a1a7-03b8-4cf2-bb26-19103b32e255/13_tokyo_pref_2023_citygml_1_op_urf_HeightControlDistrict_mvt_lod1/{z}/{x}/{y}.mvt",
    attribution:
      "3D都市モデル（Project PLATEAU）東京都23区 - 国土交通省 PLATEAU",
    attributionUrl: "https://www.geospatial.jp/ckan/dataset/plateau-tokyo23ku",
  },
} satisfies Record<string, Dataset>;

/**
 * GeoJSON datasets
 */
export const GEOJSON_DATASETS = {
  calderdaleDefibrillators: {
    url: "https://dataworks.calderdale.gov.uk/download/e6xdw/b1z/Council%20owned%20defibrillators%202025.geojson",
    attribution: "© Calderdale Council - Open Government Licence v3.0",
    attributionUrl:
      "https://dataworks.calderdale.gov.uk/dataset/defibrillators-e6xdw",
  },
} satisfies Record<string, Dataset>;

/**
 * Local asset datasets
 */
export const LOCAL_DATASETS = {
  blueMarbleClouds: {
    url: "/data/blue-marble-clouds/{z}/{x}/{y}.webp",
    attribution: "NASA Blue Marble Clouds(Converted as raster tiles)",
  },
  steelDrumGLTF: {
    url: "/glTF/steel_drum/scene.gltf",
    attribution:
      "themaayur - SKETCHFAB Standard(https://sketchfab.com/licenses)",
    attributionUrl: "/glTF/steel_drum/license.txt",
  },
  soldierGLTF: {
    url: "/glTF/Soldier/Soldier.glb",
    attribution:
      "https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/Soldier.glb",
  },
  streetLightGeoJSON: {
    url: "/street_light.geojson",
  },
  takanawaPointLightGeoJSON: {
    url: "/takanawa_point_light.geojson",
  },
  tokyoPoints100GeoJSON: {
    url: "/tokyo_points_100.geojson",
  },
  interiorGeoJSON: {
    url: "/interior.geojson",
  },
} satisfies Record<string, Dataset>;
