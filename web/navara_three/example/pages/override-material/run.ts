import ThreeView, {
  type LayerDescription,
  type Layer,
  JAPAN_GSI_ELEVATION_DECODER,
  LightProbeLayer,
  type GeoJsonLayer,
} from "@navara/three";
import { Color, SphericalHarmonics3 } from "three";
import { FolderApi, Pane } from "tweakpane";

import { TERRAIN_URLS } from "../../helpers/constants";
import { addDateControl } from "../../helpers/control";
import { SH_COEFFICIENTS } from "../../helpers/sh";

const tileUrls = {
  openstreetmap: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  gsiStd: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
  gsiSeamlessphoto:
    "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
};

const UPDATED_FEATURE = new Set();

const ENABLE_TERRAIN = true;

export const run = async (view: ThreeView) => {
  await view.init();

  const defaultAtmospheres = view.addDefaultAtmosphereLayers();
  defaultAtmospheres.sun.update({
    sun: {
      intensity: 2,
      castShadow: true,
      shadowFar: 5000,
      shadowIntensity: 1,
    },
  });

  view.addLayer({
    type: "effect",
    smaa: {},
  });

  view.setCamera({
    lng: 139.75711454748298,
    lat: 35.67564356091717,
    height: 302.0875327005024,
    heading: -64.41840149763287,
    pitch: -36.00000121921312,
    roll: 0,
  });

  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });

  view.addLayer({
    type: "tiles",
    data: { url: tileUrls.gsiSeamlessphoto },
    raster_tile: {
      max_zoom: 23,
    },
  });

  if (ENABLE_TERRAIN) {
    view.addLayer({
      type: "terrain",
      data: {
        url: TERRAIN_URLS.gsi,
      },
      raster_terrain: {
        max_zoom: 15,
        min_zoom: 5,
        elevation_decoder: JAPAN_GSI_ELEVATION_DECODER(),
        cast_shadow: true,
        receive_shadow: true,
      },
    });
  }

  const sh = new SphericalHarmonics3();
  sh.coefficients = SH_COEFFICIENTS.satellite;
  view.addLayer<LightProbeLayer>({
    type: "light",
    lightProbe: {
      sh: sh,
      intensity: 0.3,
    },
  });

  addDateControl(view, pane);
  addGeoJSONLayer(pane, view);
  addInteriorGeoJSONLayer(pane, view);
  addHeliportLayer(pane, view);
  addRoadLayer(pane, view);
  addFireproofAreaLayer(pane, view);
  addHeightControlDistrictLayer(pane, view);
  addBuildingModelLayer(pane, view);
  addSymbolLayer(pane, view);

  view.on("preUpdate", (_t) => {
    // FIXME(keiya01): Update in a cheaper way. It's heavy
    // cesium3DTiles.update({
    //   ...cesium3DTilesLayer,
    //   model: {
    //     ...cesium3DTilesLayer.model,
    //   },
    // });
  });
};

const addInteriorGeoJSONLayer = (pane: Pane, view: ThreeView) => {
  const folder = pane.addFolder({
    title: "Interior GeoJSON",
  });

  let layerDescription: GeoJsonLayer | undefined;

  let layer: Layer | undefined;
  addToggleButton(folder, (isAdded) => {
    if (isAdded) {
      layer?.delete();
      layer = undefined;
      return;
    }

    // Load GeoJSON from public directory and add as a polygon layer
    void (async () => {
      try {
        const res = await fetch("/interior.geojson");
        const data = await res.json();

        layerDescription = {
          type: "geojson",
          data,
          polygon: {
            color: 0xffffff,
            height: 5,
            extruded_height: 0,
            clamp_to_ground: false,
            cast_shadow: true,
            receive_shadow: true,
            outline_show: false,
            outline_width: 2,
            outline_color: 0xff00ff,
          },
        };

        layer = view.addLayer(layerDescription);

        layer.on("featureUpdated", (evaluator) => {
          // Prevent repeated heavy updates per feature
          if (UPDATED_FEATURE.has(evaluator.id)) return;
          UPDATED_FEATURE.add(evaluator.id);

          evaluator.evaluate((_batchId, property) => {
            const height = (property?.get("height") as number) ?? 0;
            const color = (property?.get("color") as string) ?? "#ffffff";
            const extrudedHeight =
              (property?.get("extrudedHeight") as number) ?? 0;

            return {
              height,
              extrudedHeight,
              color: new Color(color),
            };
          });
        });
      } catch (e) {
        console.warn("Failed to load /interior.geojson", e);
      }
    })();
  });

  const PARAMS = {
    outline: false,
  };

  folder.addBinding(PARAMS, "outline").on("change", ({ value }) => {
    if (layerDescription) {
      if (layerDescription.polygon) {
        layerDescription.polygon.outline_show = value;
      }
      layer?.update(layerDescription);
    }
  });
};

const addGeoJSONLayer = (pane: Pane, view: ThreeView) => {
  const layerDescriptions: LayerDescription[] = [
    {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {
              type: "point",
              No: 1,
            },
            geometry: {
              coordinates: [138.73470764482283, 35.3627947204036],
              type: "Point",
            },
          },
          {
            type: "Feature",
            properties: {
              type: "point",
              No: 2,
            },
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
      // model: {
      //   color: 0xffffff,
      //   size: 3000,
      //   height: 1,
      //   clamp_to_ground: true,
      //   url: "/glTF/CesiumMilkTruck/CesiumMilkTruck.gltf",
      // },
    },
    {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {
              type: "line",
              No: 3,
            },
            geometry: {
              coordinates: [
                [138.67683541875112, 35.4173874936028],
                [138.7969673531889, 35.42047906868497],
                [138.65597039856073, 35.284337599745484],
                [138.82415510677106, 35.313235266691635],
              ],
              type: "LineString",
            },
          },
          {
            type: "Feature",
            properties: {
              type: "line",
              No: 4,
            },
            geometry: {
              coordinates: [
                [138.79254143981473, 35.436965465402466],
                [138.68631951883958, 35.44005628905532],
                [138.78558643308418, 35.32510096156801],
                [138.63194401167237, 35.31684674944552],
              ],
              type: "LineString",
            },
          },
        ],
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
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {
              type: "polygon",
              No: 5,
            },
            geometry: {
              coordinates: [
                [
                  [138.69076314566468, 35.43223503721363],
                  [138.68002181948253, 35.33332769554936],
                  [138.83040038604383, 35.37455382402081],
                  [138.83545512777675, 35.42708660707885],
                  [138.69076314566468, 35.43223503721363],
                ],
              ],
              type: "Polygon",
            },
          },
          {
            type: "Feature",
            properties: {
              type: "polygon",
              No: 6,
            },
            geometry: {
              coordinates: [
                [
                  [138.83166407147775, 35.37249301745116],
                  [138.68002181948253, 35.330750363829665],
                  [138.66991233601522, 35.26164726716193],
                  [138.81776353171153, 35.263710900396646],
                  [138.83166407147775, 35.37249301745116],
                ],
              ],
              type: "Polygon",
            },
          },
        ],
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
  ];

  const calcColor = (num: number) => {
    const idx = num % 6;
    const r = Math.abs(Math.sin(idx + 0));
    const g = Math.abs(Math.sin(idx + 1));
    const b = Math.abs(Math.sin(idx + 2));
    return [r, g, b] as const;
  };

  // General usage: You can evaluate the color according to a feature property.
  for (const layerDescription of layerDescriptions) {
    if (!("data" in layerDescription)) continue;
    const folder = pane.addFolder({
      title: `${(Array.isArray(layerDescription.data.features) ? layerDescription.data.features[0] : layerDescription.data).geometry.type} GeoJSON`,
    });
    let layer: Layer | undefined;
    addToggleButton(folder, (isAdded) => {
      if (isAdded) {
        layer?.delete();
        layer = undefined;
        return;
      }

      layer = view.addLayer(layerDescription);
      layer.on("featureUpdated", (evaluator) => {
        // FIXME(keiya01): Handle this internally
        if (UPDATED_FEATURE.has(evaluator.id)) return;
        UPDATED_FEATURE.add(evaluator.id);

        evaluator.evaluate((_batchId, property) => {
          const num = property?.get("No") as number;
          const [r, g, b] = calcColor(num);

          return {
            color: new Color(r, g, b),
          };
        });
      });
    });
  }
};

const addHeliportLayer = (pane: Pane, view: ThreeView) => {
  const layerDescription: LayerDescription = {
    type: "mvt",
    data: {
      url: "https://assets.cms.plateau.reearth.io/assets/d4/ee889d-98b4-4425-a5b6-c60bf36e2e5a/30201_wakayama-shi_city_2023_citygml_1_op_gen_20_mvt_lod0/{z}/{x}/{y}.mvt",
    },
    point: {
      size: 0.01,
      scale_by_distance: true,
      clamp_to_ground: true,
      color: 0xff0000,
    },
  };

  const folder = pane.addFolder({
    title: "Heliports in Wakayama-shi",
  });

  let layer: Layer | undefined;
  addToggleButton(folder, (isAdded) => {
    if (isAdded) {
      layer?.delete();
      layer = undefined;
      return;
    }

    layer = view.addLayer(layerDescription);
    layer.on("featureUpdated", (evaluator) => {
      if (UPDATED_FEATURE.has(evaluator.id)) return;
      UPDATED_FEATURE.add(evaluator.id);

      evaluator.evaluate((_batchId, property) => {
        const type = property?.get("備考") as string;

        const color = (() => {
          // Athletic field
          if (type === "陸上競技場") {
            return 0x0000ff;
          }
          // Riverbed
          if (type?.endsWith("河川敷")) {
            return 0x00ff00;
          }
          return 0xff0000;
        })();

        return {
          color: new Color(color),
        };
      });
    });
  });
};

const addRoadLayer = (pane: Pane, view: ThreeView) => {
  const layerDescription: LayerDescription = {
    type: "mvt",
    data: {
      url: "https://assets.cms.plateau.reearth.io/assets/67/b5b3c6-71d8-405c-88c8-4ead72890b2b/21201_gifu-shi_city_2023_citygml_1_op_tran_mvt_lod0/{z}/{x}/{y}.mvt",
    },
    polyline: {
      width: 3,
      height: 1,
      clamp_to_ground: true,
      use_ground_normals: true,
    },
    vector_tile: {
      max_zoom: 16,
    },
  };

  const folder = pane.addFolder({
    title: "Road in Gifu-shi",
  });

  let layer: Layer | undefined;
  addToggleButton(folder, (isAdded) => {
    if (isAdded) {
      layer?.delete();
      layer = undefined;
      return;
    }

    layer = view.addLayer(layerDescription);
    layer.on("featureUpdated", (evaluator) => {
      if (UPDATED_FEATURE.has(evaluator.id)) return;
      UPDATED_FEATURE.add(evaluator.id);

      evaluator.evaluate((_batchId, property) => {
        const attrs = JSON.parse((property?.get("attributes") as string) || "");
        const generics = attrs["gen:genericAttribute"] as unknown[];
        const treeInfo = generics.find(
          (g) =>
            g &&
            typeof g === "object" &&
            "name" in g &&
            g.name === "樹木の有無",
        ) as { value: { value: string }[] };
        const code = treeInfo.value[0]?.value;

        const color = (() => {
          // Street tree
          if (code === "1") {
            return 0x00ff00;
          }
          return 0x777777;
        })();

        return {
          color: new Color(color),
        };
      });
    });
  });
};

const addFireproofAreaLayer = (pane: Pane, view: ThreeView) => {
  const layerDescription: LayerDescription = {
    type: "mvt",
    data: {
      url: "https://assets.cms.plateau.reearth.io/assets/d9/5ce2d6-0aa8-4a17-a86a-028c2dc2b817/13_tokyo_pref_2023_citygml_1_op_urf_FirePreventionDistrict_mvt_lod1/{z}/{x}/{y}.mvt",
    },
    polygon: {
      color: 0xffffff,
      height: 10,
      extruded_height: 0,
      clamp_to_ground: true,
      use_ground_normals: true,
      wireframe: false,
    },
    vector_tile: {
      max_zoom: 16,
      layers: ["FirePreventionDistrict"],
    },
  };

  const folder = pane.addFolder({
    title: "Fireproof area",
  });

  let layer: Layer | undefined;
  addToggleButton(folder, (isAdded) => {
    if (isAdded) {
      layer?.delete();
      layer = undefined;
      return;
    }

    layer = view.addLayer(layerDescription);
    layer.on("featureUpdated", (evaluator) => {
      evaluator.evaluate((_batchId, property) => {
        const functionType = property?.get("urf_function") as string;

        const color = (() => {
          // Fireproof area
          if (functionType === "防火地域") {
            return CHANGED_PARAMS_COLOR["防火地域"];
          }
          // Semi-fireproof area
          if (functionType === "準防火地域") {
            return CHANGED_PARAMS_COLOR["準防火地域"];
          }
          return CHANGED_PARAMS_COLOR["その他"];
        })();

        return {
          color: new Color(color),
        };
      });
    });
  });

  const onChange = () => {
    layer?.forceUpdate();
  };

  const PARAMS_COLOR = {
    防火地域: "#0000ff",
    準防火地域: "#00ff00",
    その他: "#ff0000",
  };
  const CHANGED_PARAMS_COLOR = { ...PARAMS_COLOR };

  const colorFolder = folder.addFolder({ title: "Color", expanded: false });
  for (const key of Object.keys(PARAMS_COLOR)) {
    const k = key as keyof typeof PARAMS_COLOR;
    const field = colorFolder
      .addBinding(PARAMS_COLOR, k)
      .on("change", ({ value }) => {
        CHANGED_PARAMS_COLOR[k] = value;
        onChange();
      });
    colorFolder.add(field);
  }
};

const addHeightControlDistrictLayer = (pane: Pane, view: ThreeView) => {
  const layerDescription: LayerDescription = {
    type: "mvt",
    data: {
      url: "https://assets.cms.plateau.reearth.io/assets/a2/81a1a7-03b8-4cf2-bb26-19103b32e255/13_tokyo_pref_2023_citygml_1_op_urf_HeightControlDistrict_mvt_lod1/{z}/{x}/{y}.mvt",
    },
    polygon: {
      height: 0,
      extruded_height: 0,
      clamp_to_ground: false,
      wireframe: false,
      // cast_shadow: true,
      // receive_shadow: true,
    },
    vector_tile: {
      max_zoom: 16,
    },
  };

  const folder = pane.addFolder({
    title: "Height control district",
  });

  let layer: Layer | undefined;
  addToggleButton(folder, (isAdded) => {
    if (isAdded) {
      layer?.delete();
      layer = undefined;
      return;
    }

    layer = view.addLayer(layerDescription);

    layer.on("featureUpdated", (evaluator) => {
      // Use the new declarative API to update feature properties
      // This will be called whenever a feature is updated
      evaluator.evaluate((_batchId, property) => {
        const attributes = JSON.parse(
          (property?.get("attributes") as string) ?? "",
        );
        const minHeight = attributes["urf:minimumBuildingHeight"];
        const maxHeight = attributes["urf:maximumBuildingHeight"];
        const extrudedHeight = Math.max(maxHeight ?? minHeight ?? 0, 1);

        const [color, scale] = (() => {
          if (extrudedHeight <= 1) {
            return [CHANGED_PARAMS_COLOR["< 1"], CHANGED_PARAMS_SCALE["<= 1"]];
          }
          if (extrudedHeight < 10) {
            return [CHANGED_PARAMS_COLOR["< 10"], CHANGED_PARAMS_SCALE["< 10"]];
          }
          if (extrudedHeight < 30) {
            return [CHANGED_PARAMS_COLOR["< 30"], CHANGED_PARAMS_SCALE["< 30"]];
          }
          return [CHANGED_PARAMS_COLOR[">= 30"], CHANGED_PARAMS_SCALE[">= 30"]];
        })();

        return {
          color: new Color(color),
          extrudedHeight: extrudedHeight * scale,
        };
      });
    });
  });

  const onChange = () => {
    layer?.forceUpdate();
  };

  const PARAMS_COLOR = {
    "< 1": "#00ff00",
    "< 10": "#ffff00",
    "< 30": "#ff00ff",
    ">= 30": "#ff0000",
  };
  const CHANGED_PARAMS_COLOR = { ...PARAMS_COLOR };

  const colorFolder = folder.addFolder({ title: "Color", expanded: false });
  for (const key of Object.keys(PARAMS_COLOR)) {
    const k = key as keyof typeof PARAMS_COLOR;
    const field = colorFolder
      .addBinding(PARAMS_COLOR, k)
      .on("change", ({ value }) => {
        CHANGED_PARAMS_COLOR[k] = value;
        onChange();
      });
    colorFolder.add(field);
  }

  const PARAMS_SCALE = {
    "<= 1": 1,
    "< 10": 1,
    "< 30": 1,
    ">= 30": 1,
  };
  const CHANGED_PARAMS_SCALE = { ...PARAMS_SCALE };

  const scaleFolder = folder.addFolder({ title: "Scale", expanded: false });
  for (const key of Object.keys(PARAMS_SCALE)) {
    const k = key as keyof typeof PARAMS_SCALE;
    const field = scaleFolder
      .addBinding(PARAMS_SCALE, k, {
        min: 0,
      })
      .on("change", ({ value }) => {
        CHANGED_PARAMS_SCALE[k] = value;
        onChange();
      });
    scaleFolder.add(field);
  }
};

const addBuildingModelLayer = (pane: Pane, view: ThreeView) => {
  const layerDescription: LayerDescription = {
    type: "cesium3dtiles",
    data: {
      url: "https://assets.cms.plateau.reearth.io/assets/db/070026-aa27-431b-8d53-7cc6b03244f8/13101_chiyoda-ku_pref_2023_citygml_1_op_bldg_3dtiles_13101_chiyoda-ku_lod2_no_texture/tileset.json",
    },
    model: {
      show: true,
      color: 0xffffff,
      metalness: 0,
      roughness: 1,
      cast_shadow: true,
      receive_shadow: true,
      height: -50,
    },
  };

  const folder = pane.addFolder({
    title: "Building model",
  });

  let layer: Layer | undefined;
  addToggleButton(folder, (isAdded) => {
    if (isAdded) {
      layer?.delete();
      layer = undefined;
      return;
    }

    layer = view.addLayer(layerDescription);
    layer.on("featureUpdated", (evaluator) => {
      evaluator.evaluate((_batchId, property) => {
        const measuredHeight = property?.get("bldg:measuredHeight") as number;

        const [color, show] = (() => {
          if (measuredHeight < 30) {
            return [CHANGED_PARAMS_COLOR["< 30"], CHANGED_PARAMS_SHOW["< 30"]];
          }
          if (measuredHeight < 60) {
            return [CHANGED_PARAMS_COLOR["< 60"], CHANGED_PARAMS_SHOW["< 60"]];
          }
          if (measuredHeight < 90) {
            return [CHANGED_PARAMS_COLOR["< 90"], CHANGED_PARAMS_SHOW["< 90"]];
          }
          return [CHANGED_PARAMS_COLOR[">= 90"], CHANGED_PARAMS_SHOW[">= 90"]];
        })();

        return {
          color: new Color(color),
          show,
        };
      });
    });

    // FIXME(keiya01): Check this pattern
    // layer.on("featureUpdated", (evaluator, t) => {
    //   const m = evaluator.obj;
    //   m.traverse((m) => {
    //     if (!(m instanceof Mesh)) return;
    //     m.material.transparent = true;
    //     m.material.opacity = Math.abs(Math.sin(t / 300));
    //   });
    // });
  });

  const onChange = () => {
    layer?.forceUpdate();
  };

  const PARAMS_COLOR = {
    "< 30": "#00ff00",
    "< 60": "#ffff00",
    "< 90": "#ff00ff",
    ">= 90": "#ff0000",
  };
  const CHANGED_PARAMS_COLOR = { ...PARAMS_COLOR };

  const colorFolder = folder.addFolder({ title: "Color", expanded: false });
  for (const key of Object.keys(PARAMS_COLOR)) {
    const k = key as keyof typeof PARAMS_COLOR;
    const field = colorFolder
      .addBinding(PARAMS_COLOR, k)
      .on("change", ({ value }) => {
        CHANGED_PARAMS_COLOR[k] = value;
        onChange();
      });
    colorFolder.add(field);
  }

  const PARAMS_SHOW = {
    "< 30": false,
    "< 60": true,
    "< 90": true,
    ">= 90": true,
  };
  const CHANGED_PARAMS_SHOW = { ...PARAMS_SHOW };

  const showFolder = folder.addFolder({ title: "Show", expanded: false });
  for (const key of Object.keys(PARAMS_SHOW)) {
    const k = key as keyof typeof PARAMS_SHOW;
    const field = showFolder
      .addBinding(PARAMS_SHOW, k)
      .on("change", ({ value }) => {
        CHANGED_PARAMS_SHOW[k] = value;
        onChange();
      });
    showFolder.add(field);
  }
};

// Ref: https://maps.gsi.go.jp/help/pdf/vector/dataspec.pdf
const ALLOWED_FT_CODE = [
  // 人口100万人以上
  51301,
  // 人口50万～100万人未満
  51302,
  // 人口50万人未満
  51303,

  // 都道府県所在地
  1401,
  // 市役所・東京都の区役所
  1402,
  // 町村役場・政令指定都市の区役所
  1403,

  // 都道府県庁
  100,
  // 市役所・東京都の区役所
  3205,
  // 町村役場・政令指定都市の区役所
  3206,
  // 広葉樹林
  6321,
  // 針葉樹林
  6322,
  // 温泉
  6331,
];
// Ref: https://maps.gsi.go.jp/help/pdf/vector/dataspec.pdf
const ALLOWED_ANNO_CTG = [
  // 市区町村
  110,
  // 山名
  311,
  // 都道府県庁
  621,
  // 神社
  661,
];

const addSymbolLayer = (pane: Pane, view: ThreeView) => {
  const layerDescription: LayerDescription = {
    type: "mvt",
    data: {
      url: "https://cyberjapandata.gsi.go.jp/xyz/experimental_bvmap/{z}/{x}/{y}.pbf",
    },
    text: {
      color: 0xffffff,
      scale_by_distance: true,
      clamp_to_ground: false,
      size: 20,
      center: {
        x: 0.5,
        y: 0,
      },
    },
    vector_tile: {
      max_zoom: 16,
      layers: ["symbol", "label"],
    },
  };

  const folder = pane.addFolder({
    title: "Symbol",
  });

  let layer: Layer | undefined;
  addToggleButton(folder, (isAdded) => {
    if (isAdded) {
      layer?.delete();
      layer = undefined;
      return;
    }

    layer = view.addLayer(layerDescription);
    layer.on("featureUpdated", (evaluator) => {
      if (UPDATED_FEATURE.has(evaluator.id)) return;
      UPDATED_FEATURE.add(evaluator.id);

      const uniqueLabels = new Set();
      evaluator.evaluate((_batchId, property) => {
        const text = (property?.get("knj") ?? property?.get("name")) as string;
        const ftCode = property?.get("ftCode") as number;
        const annoCtg = property?.get("annoCtg") as number;

        if (
          !ALLOWED_FT_CODE.includes(ftCode) ||
          (annoCtg && !ALLOWED_ANNO_CTG.includes(annoCtg))
        )
          return { text: "" };

        if (uniqueLabels.has(text)) return { text: "" };

        uniqueLabels.add(text);

        return {
          text,
        };
      });
    });
  });
};

const addToggleButton = (folder: FolderApi, f: (isAdded: boolean) => void) => {
  const addRemoveButton = folder.addButton({
    title: "Add",
  });
  let isAdded = false;
  addRemoveButton.on("click", () => {
    f(isAdded);
    addRemoveButton.title = isAdded ? "Add" : "Remove";
    isAdded = !isAdded;
  });
};
