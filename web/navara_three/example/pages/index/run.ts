import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  MAPBOX_ELEVATION_DECODER,
} from "@navara/three";
import { type LayerDescription } from "@navara/three";
import { AxesHelper } from "three";
import { Pane } from "tweakpane";

type MaterialLayerDescription = Exclude<
  LayerDescription,
  { type: "tiles" } | { type: "terrain" }
>;

const geoLayersDef: MaterialLayerDescription[] = [
  {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            coordinates: [139.70513431449842, 35.69279782617761],
            type: "Point",
          },
        },
        {
          type: "Feature",
          properties: {},
          geometry: {
            coordinates: [140.13033810546995, 35.60447056434825],
            type: "Point",
          },
        },
        {
          type: "Feature",
          properties: {},
          geometry: {
            coordinates: [139.64591330307843, 35.85950281451436],
            type: "Point",
          },
        },
        {
          type: "Feature",
          properties: {},
          geometry: {
            coordinates: [139.63564871528018, 35.44128807202607],
            type: "Point",
          },
        },
        {
          type: "Feature",
          properties: {},
          geometry: {
            coordinates: [139.28453080888477, 35.51560883529815],
            type: "Point",
          },
        },
      ],
    },
    point: {
      color: 0xffffff,
      size: 0.1,
      height: 1,
      scale_by_distance: true,
      clamp_to_ground: true,
      depth_test: true,
    },
  },

  {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            coordinates: [138.73470764482283, 35.3627947204036],
            type: "Point",
          },
        },
        {
          type: "Feature",
          properties: {},
          geometry: {
            coordinates: [138.7311922738062, 35.359766379480206],
            type: "Point",
          },
        },
      ],
    },
    billboard: {
      color: 0xffffff,
      size: 0.05,
      height: 1,
      scale_by_distance: true,
      clamp_to_ground: true,
      depth_test: true,
      url: "/example.png",
    },
  },

  {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            coordinates: [135.7672689034169, 35.011034421881675],
            type: "Point",
          },
        },
      ],
    },
    text: {
      color: 0xffffff,
      height: 1,
      scale_by_distance: true,
      clamp_to_ground: true,
      depth_test: true,
      text: "hello 京都",
      // font: "/font/LoveDays-2v7Oe.ttf",
      background_color: 0x0a70c2,
      border_color: 0xf8e43c,
      border_width: 0.05,
      size: 2,
    },
  },

  {
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: {
        coordinates: [
          [138.64270223212833, 35.42793245331515],
          [138.8398612065625, 35.42635304536398],
          [138.64071756664583, 35.33027587314082],
          [138.8449071750585, 35.32671062382879],
        ],
        type: "LineString",
      },
    },
    polyline: {
      show: true,
      color: 0xff0000,
      width: 2,
      height: 1,
      clamp_to_ground: true,
      use_ground_normals: true,
    },
  },

  {
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: {
        coordinates: [
          [70.07775498388432, 51.60988186114207],
          [162.91882196095776, 28.580939466061338],
        ],
        type: "LineString",
      },
    },
    polyline: {
      show: true,
      color: 0x00ff00,
      width: 5,
      height: 1,
      clamp_to_ground: true,
      use_ground_normals: true,
    },
  },

  {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            coordinates: [30, 30],
            type: "Point",
          },
        },
      ],
    },
    model: {
      show: true,
      size: 300000,
      height: -30000,
      clamp_to_ground: true,
      url: "/glTF/CesiumMilkTruck/CesiumMilkTruck.gltf",
      should_rotate_in_default: true,
      id_property: "gml_id",
      color: 0xffffff,
      metalness: 0.1,
      roughness: 0.1,
    },
  },
  {
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: {
        coordinates: [
          [
            [138.66861922558115, 35.46838056308519],
            [138.6559918549957, 35.29164005065681],
            [138.81174182884172, 35.279838616806046],
            [138.8071009152797, 35.436389815907134],
            [138.66861922558115, 35.46838056308519],
          ],
          [
            [138.75848857087954, 35.327942674501244],
            [138.75848857087954, 35.30705741002396],
            [138.7099676960035, 35.30705741002396],
            [138.75848857087954, 35.327942674501244],
          ],
          [
            [138.69753667745107, 35.422992283445495],
            [138.720671486169, 35.422992283445495],
            [138.720671486169, 35.400362713394486],
            [138.69753667745107, 35.400362713394486],
            [138.69753667745107, 35.422992283445495],
          ],
          [
            [138.7586738667644, 35.412062776959175],
            [138.78255935881282, 35.412062776959175],
            [138.78255935881282, 35.39057755353295],
            [138.7586738667644, 35.39057755353295],
            [138.7586738667644, 35.412062776959175],
          ],
          [
            [138.7211460206937, 35.370481559123604],
            [138.7388966476277, 35.370481559123604],
            [138.7388966476277, 35.35731998796588],
            [138.7211460206937, 35.35731998796588],
            [138.7211460206937, 35.370481559123604],
          ],
          // [
          //   [31.72775849062026,
          // 52.51516008351888],
          // [99.72788480154168,
          // -48.26315338939218],
          // [204.13004176416695,
          // 36.2117078118584],
          // [31.72775849062026,
          // 52.51516008351888]
          // ]
          // [
          //   [
          //     138.16153530723932,
          //     35.49745160501608
          //   ],
          //   [
          //     138.19227634675173,
          //     35.384656761195004
          //   ],
          //   [
          //     138.1164119320788,
          //     35.266968102144645
          //   ],
          //   [
          //     138.32324088134442,
          //     35.27178582769753
          //   ],
          //   [
          //     138.45178492439038,
          //     35.31276482104383
          //   ],
          //   [
          //     138.3980434749186,
          //     35.428659522373536
          //   ],
          //   [
          //     138.16153530723932,
          //     35.49745160501608
          //   ]
          // ]
        ],
        type: "Polygon",
      },
    },
    polygon: {
      color: 0x00aaff,
      height: 0,
      extruded_height: 5000,
      clamp_to_ground: true,
      use_ground_normals: true,
      wireframe: false,
    },
  },
  {
    type: "b3dm",
    data: {
      url: "https://assets.cms.plateau.reearth.io/assets/23/bf39db-cd61-4e07-9be3-065a13ddf432/13101_chiyoda-ku_pref_2023_citygml_1_op_bldg_3dtiles_13101_chiyoda-ku_lod2/data/data500.b3dm",
    },
    model: {
      show: true,
      id_property: "gml_id",
      color: 0xffffff,
      metalness: 0.1,
      roughness: 0.1,
    },
  },
  {
    type: "cesium3dtiles",
    data: {
      url: "https://assets.cms.plateau.reearth.io/assets/db/070026-aa27-431b-8d53-7cc6b03244f8/13101_chiyoda-ku_pref_2023_citygml_1_op_bldg_3dtiles_13101_chiyoda-ku_lod2_no_texture/tileset.json",
    },
    model: {
      show: true,
      id_property: "gml_id",
      color: 0xffffff,
      metalness: 0.1,
      roughness: 0.1,
    },
  },
  {
    type: "cesium3dtiles",
    data: {
      url: "https://assets.cms.plateau.reearth.io/assets/4c/f2436a-e2be-40e2-83da-f1781f36e30b/13102_chuo-ku_pref_2023_citygml_1_op_bldg_3dtiles_13102_chuo-ku_lod2_no_texture/tileset.json",
    },
    model: {
      show: true,
      id_property: "gml_id",
      color: 0xffffff,
      metalness: 0.1,
      roughness: 0.1,
    },
  },
  {
    type: "mvt",
    data: {
      // url: "https://assets.cms.plateau.reearth.io/assets/d4/ee889d-98b4-4425-a5b6-c60bf36e2e5a/30201_wakayama-shi_city_2023_citygml_1_op_gen_20_mvt_lod0/12/3587/1632.mvt",
      url: "https://assets.cms.plateau.reearth.io/assets/d4/ee889d-98b4-4425-a5b6-c60bf36e2e5a/30201_wakayama-shi_city_2023_citygml_1_op_gen_20_mvt_lod0/{z}/{x}/{y}.mvt",
    },
    point: {
      color: 0xff0000,
      size: 0.01,
      height: 1,
      // TODO: This should be abstracted like top-left/center/right, bottom-left/center/right
      center: {
        x: 0.5,
        y: 0,
      },
      scale_by_distance: true,
      clamp_to_ground: true,
      depth_test: true,
      id_property: "gml_id",
    },
  },
  {
    type: "mvt",
    data: {
      // url: "https://assets.cms.plateau.reearth.io/assets/e3/a2373b-6dd5-4c8f-a771-d360dc59d952/20214_chino-shi_city_2023_citygml_1_op_tran_mvt_lod0/10/904/402.mvt",
      // Heavy
      // url: "https://assets.cms.plateau.reearth.io/assets/e3/a2373b-6dd5-4c8f-a771-d360dc59d952/20214_chino-shi_city_2023_citygml_1_op_tran_mvt_lod0/{z}/{x}/{y}.mvt",
      // Light
      url: "https://assets.cms.plateau.reearth.io/assets/67/b5b3c6-71d8-405c-88c8-4ead72890b2b/21201_gifu-shi_city_2023_citygml_1_op_tran_mvt_lod0/{z}/{x}/{y}.mvt",
    },
    polyline: {
      show: true,
      color: 0x00ff00,
      width: 2,
      height: 1,
      clamp_to_ground: true,
      id_property: "gml_id",
      use_ground_normals: true,
    },
    vector_tile: {
      max_zoom: 16,
    },
  },
  {
    type: "mvt",
    data: {
      // url: "https://assets.cms.plateau.reearth.io/assets/d3/b6e654-9c94-43ae-9109-3c35ece89cbd/13102_chuo-ku_pref_2023_citygml_1_op_luse_mvt/16/58214/25806.mvt",
      // url: "https://assets.cms.plateau.reearth.io/assets/d3/b6e654-9c94-43ae-9109-3c35ece89cbd/13102_chuo-ku_pref_2023_citygml_1_op_luse_mvt/{z}/{x}/{y}.mvt",
      // url: "https://assets.cms.plateau.reearth.io/assets/c7/a9681c-bf92-4496-a367-f4d2dcf35aec/13101_chiyoda-ku_pref_2023_citygml_1_op_tran_mvt_lod1/{z}/{x}/{y}.mvt",
      url: "https://assets.cms.plateau.reearth.io/assets/a2/81a1a7-03b8-4cf2-bb26-19103b32e255/13_tokyo_pref_2023_citygml_1_op_urf_HeightControlDistrict_mvt_lod1/{z}/{x}/{y}.mvt",
    },
    polygon: {
      color: 0x00aaff,
      height: 10,
      extruded_height: 0,
      clamp_to_ground: true,
      use_ground_normals: true,
      wireframe: false,
      id_property: "gml_id",
    },
    vector_tile: {
      max_zoom: 16,
      layers: ["HeightControlDistrict"],
    },
  },
];

export const run = async (view: ThreeView) => {
  await view.init();

  const axesHelper = new AxesHelper(5);
  axesHelper.scale.multiplyScalar(1e9);
  view.scene.add(axesHelper);

  const tileUrls = {
    openstreetmap: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    gsiStd: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
    gsiSeamlessphoto:
      "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
  };

  const terrainUrls = {
    gsi: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
    mapbox: `https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=${
      import.meta.env.NAVARA_MAPBOX_ACCESS_TOKEN
    }`,
  };

  // For debug
  // view.addLayer({
  //   type: "tiles",
  //   color: 0xffffff,
  //   segments: 10,
  //   height: 0,
  //   tile_url: "http://localhost:8888/{z}/{x}/{y}.png",
  //   z: 4,
  //   max_zoom: 21,
  //   wireframe: false,
  // });

  view.addLayer({
    type: "tiles",
    data: { url: tileUrls.openstreetmap },
    raster_tile: {
      max_zoom: 23,
      wireframe: false,
    },
  });

  const terrainType: "mapbox" | "gsi" = "gsi";

  view.addLayer({
    type: "terrain",
    data: {
      // @ts-expect-error : Make switch button later
      url: terrainType === "mapbox" ? terrainUrls.mapbox : terrainUrls.gsi,
    },
    raster_terrain: {
      max_zoom: 15,
      min_zoom: 5,
      elevation_decoder:
        // @ts-expect-error : Make switch button later
        terrainType === "mapbox"
          ? MAPBOX_ELEVATION_DECODER()
          : JAPAN_GSI_ELEVATION_DECODER(),
    },
  });

  const geoLayerMap = new Map<string, MaterialLayerDescription>();
  geoLayersDef.forEach((layer) => {
    const layerId = view.addLayer(layer);
    if (layerId) {
      geoLayerMap.set(layerId, layer);
    }
  });

  // view.addLayer({
  //   type: "mvt",
  //   layers: ["Road"],
  //   url: "https://assets.cms.plateau.reearth.io/assets/29/cca394-b505-4b92-a3f6-4b90573f2b47/14100_yokohama-shi_city_2023_citygml_1_op_tran_mvt_lod1/{z}/{x}/{y}.mvt",
  //   zoom: 13,
  //   extent: yokohamaExtent,
  //   height: 36.5 + 1,
  //   color: 0xffffff,
  // });

  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });

  const layerIds = Array.from(geoLayerMap.keys());
  const layerDeleted = layerIds.map(() => 0);

  const layerIdOptions: Record<string, number> = {};
  for (let i = 0; i < layerIds.length; i++) {
    layerIdOptions["layer" + (i + 1)] = i;
  }

  const paneParams = {
    layer: 0,
    material: "",

    show: true,
    color: "#ffffff",
    size: 1,
    width: 1,
    height: 1,
    extrudedHeight: 1,
    clampToGround: false,
    useGroundNormals: false,
    wireframe: false,
    scaleByDistance: true,
    shouldRotateInDefault: true,
    roughness: 1.0,
    metalness: 0.0,
    text: "hello",
    font_family: "",
    resolution: 1,
    background_color: "#0a70c2",
    border_color: "#f8e43c",
    border_width: 2,
  };

  pane
    // @ts-expect-error : Missing Type Definitions ?
    .addBinding(paneParams, "layer", { options: layerIdOptions })
    .on("change", onLayerChange);

  const btnCtrl = pane
    // @ts-expect-error : Missing Type Definitions ?
    .addButton({ title: "Delete Layer", label: "" })
    .on("click", onDeleteBtnClick);

  let materialCtrl = createMaterialCtrl(
    pane,
    paneParams,
    geoLayerMap.get(layerIds[0]),
  );

  if (materialCtrl) {
    materialCtrl.on("change", () => {
      if (paramCtrl) {
        paramCtrl.dispose();
      }
      paramCtrl = createParamCtrl(
        pane,
        paneParams,
        geoLayerMap.get(layerIds[paneParams.layer]),
        onParamChange,
      );
    });
  }

  let paramCtrl = createParamCtrl(
    pane,
    paneParams,
    geoLayerMap.get(layerIds[0]),
    onParamChange,
  );

  function onDeleteBtnClick() {
    if (btnCtrl.title == "Delete Layer") {
      view.deleteLayer(layerIds[paneParams.layer]);
      layerDeleted[paneParams.layer] = 1;
      btnCtrl.title = "Add Layer";
    } else {
      const oldLayerId = layerIds[paneParams.layer];
      const layerDef = geoLayerMap.get(oldLayerId);
      if (layerDef) {
        const newLayerId = view.addLayer(layerDef);
        if (newLayerId) {
          geoLayerMap.set(newLayerId, layerDef);
          layerIds[paneParams.layer] = newLayerId;
          layerDeleted[paneParams.layer] = 0;
        }
      }

      geoLayerMap.delete(oldLayerId);

      btnCtrl.title = "Delete Layer";
    }
  }

  function onLayerChange() {
    if (layerDeleted[paneParams.layer]) {
      btnCtrl.title = "Add Layer";
    } else {
      btnCtrl.title = "Delete Layer";
    }

    if (materialCtrl) {
      materialCtrl.dispose();
    }

    if (paramCtrl) {
      paramCtrl.dispose();
    }

    materialCtrl = createMaterialCtrl(
      pane,
      paneParams,
      geoLayerMap.get(layerIds[paneParams.layer]),
    );

    if (materialCtrl) {
      materialCtrl.on("change", () => {
        if (paramCtrl) {
          paramCtrl.dispose();
        }
        paramCtrl = createParamCtrl(
          pane,
          paneParams,
          geoLayerMap.get(layerIds[paneParams.layer]),
          onParamChange,
        );
      });
    }

    paramCtrl = createParamCtrl(
      pane,
      paneParams,
      geoLayerMap.get(layerIds[paneParams.layer]),
      onParamChange,
    );
  }

  function onParamChange() {
    const layerId = layerIds[paneParams.layer];
    const layer = geoLayerMap.get(layerId);
    if (layer && paneParams.material in layer) {
      const material = layer[paneParams.material as keyof typeof layer];

      material.show = paneParams.show;

      if ("color" in material) {
        material.color = parseInt(paneParams.color.replace("#", ""), 16);
      }

      if ("size" in material) {
        material.size = paneParams.size;
      }

      if ("width" in material) {
        material.width = paneParams.width;
      }

      if ("height" in material) {
        material.height = paneParams.height;
      }

      if ("extruded_height" in material) {
        material.extruded_height = paneParams.extrudedHeight;
      }

      if ("clamp_to_ground" in material) {
        material.clamp_to_ground = paneParams.clampToGround;
      }

      if ("use_ground_normals" in material) {
        material.use_ground_normals = paneParams.useGroundNormals;
      }

      if ("wireframe" in material) {
        material.wireframe = paneParams.wireframe;
      }

      if ("scale_by_distance" in material) {
        material.scale_by_distance = paneParams.scaleByDistance;
      }

      if ("should_rotate_in_default" in material) {
        material.should_rotate_in_default = paneParams.shouldRotateInDefault;
      }

      if ("metalness" in material) {
        material.metalness = paneParams.metalness;
      }

      if ("roughness" in material) {
        material.roughness = paneParams.roughness;
      }

      if ("text" in material) {
        material.text = paneParams.text;
      }

      if ("font_family" in material) {
        material.font_family = paneParams.font_family;
      }

      if ("resolution" in material) {
        material.resolution = paneParams.resolution;
      }

      if ("background_color" in material) {
        material.background_color = parseInt(
          paneParams.background_color.replace("#", ""),
          16,
        );
      }

      if ("border_color" in material) {
        material.border_color = parseInt(
          paneParams.border_color.replace("#", ""),
          16,
        );
      }

      if ("border_width" in material) {
        material.border_width = paneParams.border_width;
      }

      view.updateLayer(layerId, {
        type: layer.type,
        data: layer.data,
        [paneParams.material]: material,
      });
    }
  }
};

function createParamCtrl(
  pane: Pane,
  paneParams: any,
  layer: MaterialLayerDescription | undefined,
  changeFunc: () => void,
) {
  if (!layer) {
    return undefined;
  }

  const material = layer[paneParams.material as keyof typeof layer];
  if (material) {
    // @ts-expect-error : Missing Type Definitions ?
    const f = pane.addFolder({
      title: "",
      expanded: true,
    });

    paneParams.show = material.show ?? true;
    f.addBinding(paneParams, "show").on("change", changeFunc);

    if ("color" in material) {
      paneParams.color = "#" + material.color.toString(16).padStart(6, "0");
      // @ts-expect-error : Missing Type Definitions ?
      f.addBinding(paneParams, "color").on("change", (ev) => {
        if (ev.last) {
          changeFunc();
        }
      });
    }

    if ("size" in material) {
      paneParams.size = material.size;
      f.addBinding(paneParams, "size").on("change", changeFunc);
    }

    if ("width" in material) {
      paneParams.width = material.width;
      f.addBinding(paneParams, "width").on("change", changeFunc);
    }

    if ("height" in material) {
      paneParams.height = material.height;
      f.addBinding(paneParams, "height").on("change", changeFunc);
    }

    if ("extruded_height" in material) {
      paneParams.extrudedHeight = material.extruded_height;
      f.addBinding(paneParams, "extrudedHeight").on("change", changeFunc);
    }

    if ("clamp_to_ground" in material) {
      paneParams.clampToGround = material.clamp_to_ground;
      f.addBinding(paneParams, "clampToGround").on("change", changeFunc);
    }

    if ("use_ground_normals" in material) {
      paneParams.useGroundNormals = material.use_ground_normals;
      f.addBinding(paneParams, "useGroundNormals").on("change", changeFunc);
    }

    if ("wireframe" in material) {
      paneParams.wireframe = material.wireframe;
      f.addBinding(paneParams, "wireframe").on("change", changeFunc);
    }

    if ("scale_by_distance" in material) {
      paneParams.scaleByDistance = material.scale_by_distance;
      f.addBinding(paneParams, "scaleByDistance").on("change", changeFunc);
    }

    if ("should_rotate_in_default" in material) {
      paneParams.shouldRotateInDefault = material.should_rotate_in_default;
      f.addBinding(paneParams, "shouldRotateInDefault").on(
        "change",
        changeFunc,
      );
    }

    if ("metalness" in material) {
      paneParams.metalness = material.metalness;
      f.addBinding(paneParams, "metalness", { min: 0.0, max: 1.0 }).on(
        "change",
        changeFunc,
      );
    }

    if ("roughness" in material) {
      paneParams.roughness = material.roughness;
      f.addBinding(paneParams, "roughness", { min: 0.0, max: 1.0 }).on(
        "change",
        changeFunc,
      );
    }

    if ("text" in material) {
      paneParams.text = material.text;
      f.addBinding(paneParams, "text").on("change", changeFunc);
    }

    if ("font_family" in material) {
      paneParams.font_family = material.font_family;
      f.addBinding(paneParams, "font_family").on("change", changeFunc);
    }

    if ("resolution" in material) {
      paneParams.resolution = material.resolution;
      f.addBinding(paneParams, "resolution").on("change", changeFunc);
    }

    if ("background_color" in material) {
      paneParams.background_color =
        "#" + material.background_color.toString(16).padStart(6, "0");
      // @ts-expect-error : Missing Type Definitions ?
      f.addBinding(paneParams, "background_color").on("change", (ev) => {
        if (ev.last) {
          changeFunc();
        }
      });
    }

    if ("border_color" in material) {
      paneParams.border_color =
        "#" + material.border_color.toString(16).padStart(6, "0");
      // @ts-expect-error : Missing Type Definitions ?
      f.addBinding(paneParams, "border_color").on("change", (ev) => {
        if (ev.last) {
          changeFunc();
        }
      });
    }

    if ("border_width" in material) {
      paneParams.border_width = material.border_width;
      f.addBinding(paneParams, "border_width").on("change", changeFunc);
    }

    return f;
  }

  return undefined;
}

function createMaterialCtrl(
  pane: Pane,
  paneParams: any,
  layer: MaterialLayerDescription | undefined,
) {
  if (layer) {
    const options = getMaterialOptions(layer);

    // @ts-expect-error : Missing Type Definitions ?
    const materialCtrl = pane.addBinding(paneParams, "material", {
      options: options,
    });

    const firstOptionKey = Object.keys(options)[0];
    paneParams.material = firstOptionKey;
    materialCtrl.refresh();
    return materialCtrl;
  } else {
    return undefined;
  }
}

function getMaterialOptions(layer: MaterialLayerDescription) {
  const materials = [];
  if ("point" in layer) {
    materials.push("point");
  }
  if ("billboard" in layer) {
    materials.push("billboard");
  }
  if ("text" in layer) {
    materials.push("text");
  }
  if ("model" in layer) {
    materials.push("model");
  }
  if ("polyline" in layer) {
    materials.push("polyline");
  }
  if ("polygon" in layer) {
    materials.push("polygon");
  }

  const ret: any = {};
  materials.forEach((m) => {
    ret[m] = m;
  });

  return ret;
}
