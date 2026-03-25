import ThreeView, {
  type LayerDescription,
  type Layer,
  Color,
} from "@navara/three";
import { isNumber } from "lodash-es";
import {
  FolderApi,
  Pane,
  TpChangeEvent,
  type BindingParams,
  type InputBindingApi,
} from "tweakpane";

export type MaterialLayerDescription = Exclude<
  LayerDescription,
  | { type: "terrain" }
  | { type: "mesh" }
  | { type: "light" }
  | { type: "effect" }
>;

const selectedFeatures = new Set<string>();
const selectedBatchIds = new Set<number>();

const addFeatureUpdateHandler = (
  layerDesc: MaterialLayerDescription,
  layer: Layer,
) => {
  // Function to dynamically get the current default color from layerDesc
  const getDefaultColor = (): number | Color => {
    let defaultColor: number | Color = 0xffffff;

    if (layerDesc.type == "geojson") {
      if (layerDesc.point && layerDesc.point.color !== undefined) {
        defaultColor = layerDesc.point.color;
      } else if (
        layerDesc.billboard &&
        layerDesc.billboard.color !== undefined
      ) {
        defaultColor = layerDesc.billboard.color;
      } else if (layerDesc.text && layerDesc.text.color !== undefined) {
        defaultColor = layerDesc.text.color;
      } else if (layerDesc.polyline && layerDesc.polyline.color !== undefined) {
        defaultColor = layerDesc.polyline.color;
      } else if (layerDesc.polygon && layerDesc.polygon.color !== undefined) {
        defaultColor = layerDesc.polygon.color;
      }
    } else if (layerDesc.type == "b3dm") {
      if (layerDesc.model && layerDesc.model.color !== undefined) {
        defaultColor = layerDesc.model.color;
      }
    } else if (layerDesc.type == "cesium3dtiles") {
      if (layerDesc.model && layerDesc.model.color !== undefined) {
        defaultColor = layerDesc.model.color;
      }
    } else if (layerDesc.type == "mvt") {
      if (layerDesc.point && layerDesc.point.color !== undefined) {
        defaultColor = layerDesc.point.color;
      } else if (
        layerDesc.billboard &&
        layerDesc.billboard.color !== undefined
      ) {
        defaultColor = layerDesc.billboard.color;
      } else if (layerDesc.text && layerDesc.text.color !== undefined) {
        defaultColor = layerDesc.text.color;
      } else if (layerDesc.polyline && layerDesc.polyline.color !== undefined) {
        defaultColor = layerDesc.polyline.color;
      } else if (layerDesc.polygon && layerDesc.polygon.color !== undefined) {
        defaultColor = layerDesc.polygon.color;
      }
    }

    return defaultColor;
  };

  layer.on("featureUpdated", ({ evaluator }) => {
    evaluator.evaluate(
      ({ batchId, properties }) => {
        const gmlId = properties?.["gml_id"];
        if (gmlId && selectedFeatures.has(gmlId as string)) {
          return {
            color: new Color().setHex(0x00ffff),
          };
        } else if (batchId !== undefined && selectedBatchIds.has(batchId)) {
          return {
            color: new Color().setHex(0x00ffff),
          };
        }

        // Dynamically get the current default color
        let defaultColor = getDefaultColor();
        if (isNumber(defaultColor)) {
          defaultColor = new Color().setHex(defaultColor);
        }
        return {
          color: defaultColor,
        };
      },
      { filters: ["gml_id"] },
    );
  });
};

export const addCtrlPanel = (
  layers: MaterialLayerDescription[],
  view: ThreeView,
  paneInput?: Pane,
) => {
  const layerInstMap = new Map<string, Layer>();

  view.on("pick", (info) => {
    const gmlId = info?.properties?.["gml_id"];
    if (gmlId) {
      // if gml_id exists, use it for selection
      selectedFeatures.add(gmlId as string);

      if (isNumber(info?.batchId)) {
        const layerId = info?.layerId;
        if (layerId) {
          const layer = layerInstMap.get(layerId);
          if (layer) {
            layer.forceUpdate();
          }
        }
      }
    } else if (isNumber(info?.batchId)) {
      // else if batchId exists, use it for selection
      selectedBatchIds.add(info?.batchId);

      const layerId = info?.layerId;
      if (layerId) {
        const layer = layerInstMap.get(layerId);
        if (layer) {
          layer.forceUpdate();
        }
      }
    } else {
      // else clear all selections
      selectedFeatures.clear();
      selectedBatchIds.clear();

      layerInstMap.forEach((layer) => {
        layer.forceUpdate();
      });
    }
  });

  const layerMap = new Map<string, MaterialLayerDescription>();
  layers.forEach((layerDef) => {
    const layer = view.addLayer(layerDef);

    if (layer.id) {
      layerInstMap.set(layer.id, layer);
      layerMap.set(layer.id, layerDef);
    }

    if (layerDef.type !== "tiles") {
      addFeatureUpdateHandler(layerDef, layer);
    }
  });

  const layerIds = Array.from(layerMap.keys());
  const layerDeleted = layerIds.map(() => 0);

  const layerIdOptions: Record<string, number> = {};
  for (let i = 0; i < layerIds.length; i++) {
    layerIdOptions["layer" + (i + 1)] = i;
  }

  let pane: Pane;
  if (paneInput) {
    pane = paneInput;
  } else {
    pane = new Pane({
      title: "Parameters",
      expanded: true,
    });
    pane.element.style.position = "absolute";
    pane.element.style.width = "340px";
    pane.element.style.right = "0px";
  }

  const paneParams = {
    layer: 0,
    material: "",

    show: true,
    color: "#ffffff",
    opacity: 1,
    size: 1,
    width: 1,
    maxWidth: 10000,
    height: 1,
    extrudedHeight: 1,
    clampToGround: false,
    useGroundNormals: false,
    wireframe: false,
    scaleByDistance: true,
    shouldRotateInDefault: true,
    roughness: 1.0,
    metalness: 0.0,
    text: "",
    font: "",
    backgroundColor: "#0a70c2",
    borderColor: "#f8e43c",
    borderWidth: 0.0,
    cornerRadius: 0.0,
    center: { x: 0, y: 0 },
    padding: { x: 0, y: 0 },
    transparent: false,

    outlineColor: "#ffffff",
    outlineShow: true,
    outlineWidth: 1,
    outlineBlur: 0.0,
    outlineOffset: { x: 0, y: 0 },
    outlineOpacity: 1.0,
    surfaceShow: true,
    pointSize: 0.3,
    offsetDepth: true,
  };

  pane
    .addBinding(paneParams, "layer", { options: layerIdOptions })
    .on("change", onLayerChange);

  const btnCtrl = pane
    .addButton({ title: "Delete Layer", label: "" })
    .on("click", onDeleteBtnClick);

  let materialCtrl = createMaterialCtrl(
    pane,
    paneParams,
    layerMap.get(layerIds[0]),
  );

  if (materialCtrl) {
    materialCtrl.on("change", () => {
      if (paramCtrl) {
        paramCtrl.dispose();
      }
      paramCtrl = createParamCtrl(
        pane,
        paneParams,
        layerMap.get(layerIds[paneParams.layer]),
        onParamChange,
      );
    });
  }

  let paramCtrl = createParamCtrl(
    pane,
    paneParams,
    layerMap.get(layerIds[0]),
    onParamChange,
  );

  function onDeleteBtnClick() {
    if (btnCtrl.title == "Delete Layer") {
      view.deleteLayerById(layerIds[paneParams.layer]);
      layerInstMap.delete(layerIds[paneParams.layer]);
      layerDeleted[paneParams.layer] = 1;
      btnCtrl.title = "Add Layer";
    } else {
      const oldLayerId = layerIds[paneParams.layer];
      const layerDef = layerMap.get(oldLayerId);
      if (layerDef) {
        const newLayer = view.addLayer(layerDef);
        if (newLayer.id) {
          layerInstMap.set(newLayer.id, newLayer);
          layerMap.set(newLayer.id, layerDef);
          layerIds[paneParams.layer] = newLayer.id;
          layerDeleted[paneParams.layer] = 0;

          if (layerDef.type !== "tiles") {
            addFeatureUpdateHandler(layerDef, newLayer);
          }
        }
      }

      layerMap.delete(oldLayerId);

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
      layerMap.get(layerIds[paneParams.layer]),
    );

    if (materialCtrl) {
      materialCtrl.on("change", () => {
        if (paramCtrl) {
          paramCtrl.dispose();
        }
        paramCtrl = createParamCtrl(
          pane,
          paneParams,
          layerMap.get(layerIds[paneParams.layer]),
          onParamChange,
        );
      });
    }

    paramCtrl = createParamCtrl(
      pane,
      paneParams,
      layerMap.get(layerIds[paneParams.layer]),
      onParamChange,
    );
  }

  function onParamChange() {
    const layerId = layerIds[paneParams.layer];
    const layer = layerMap.get(layerId);
    if (layer && paneParams.material in layer) {
      const material = layer[paneParams.material as keyof typeof layer];

      material.show = paneParams.show;

      if ("color" in material) {
        material.color = new Color().setStyle(paneParams.color);
      }

      if ("opacity" in material) {
        material.opacity = paneParams.opacity;
      }

      if ("size" in material) {
        material.size = paneParams.size;
      }

      if ("width" in material) {
        material.width = paneParams.width;
      }

      if ("maxWidth" in material) {
        material.maxWidth = paneParams.maxWidth;
      }

      if ("height" in material) {
        material.height = paneParams.height;
      }

      if ("extrudedHeight" in material) {
        material.extrudedHeight = paneParams.extrudedHeight;
      }

      if ("clampToGround" in material) {
        material.clampToGround = paneParams.clampToGround;
      }

      if ("useGroundNormals" in material) {
        material.useGroundNormals = paneParams.useGroundNormals;
      }

      if ("wireframe" in material) {
        material.wireframe = paneParams.wireframe;
      }

      if ("scaleByDistance" in material) {
        material.scaleByDistance = paneParams.scaleByDistance;
      }

      if ("shouldRotateInDefault" in material) {
        material.shouldRotateInDefault = paneParams.shouldRotateInDefault;
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

      if ("font" in material) {
        material.font = paneParams.font;
      }

      if ("backgroundColor" in material) {
        material.backgroundColor = new Color().setStyle(
          paneParams.backgroundColor,
        );
      }

      if ("borderColor" in material) {
        material.borderColor = new Color().setStyle(paneParams.borderColor);
      }

      if ("borderWidth" in material) {
        material.borderWidth = paneParams.borderWidth;
      }

      if ("cornerRadius" in material) {
        material.cornerRadius = paneParams.cornerRadius;
      }

      if ("center" in material) {
        material.center.x = paneParams.center.x;
        material.center.y = paneParams.center.y;
      }

      if ("padding" in material) {
        material.padding.x = paneParams.padding.x;
        material.padding.y = paneParams.padding.y;
      }

      if ("transparent" in material) {
        material.transparent = paneParams.transparent;
      }

      if ("outlineColor" in material) {
        material.outlineColor = parseInt(
          paneParams.outlineColor.replace("#", ""),
          16,
        );
      }

      if ("outlineShow" in material) {
        material.outlineShow = paneParams.outlineShow;
      }

      if ("outlineWidth" in material) {
        material.outlineWidth = paneParams.outlineWidth;
      }

      if ("outlineBlur" in material) {
        material.outlineBlur = paneParams.outlineBlur;
      }

      if ("outlineOffset" in material) {
        material.outlineOffset.x = paneParams.outlineOffset.x;
        material.outlineOffset.y = paneParams.outlineOffset.y;
      }

      if ("outlineOpacity" in material) {
        material.outlineOpacity = paneParams.outlineOpacity;
      }

      if ("surfaceShow" in material) {
        material.surfaceShow = paneParams.surfaceShow;
      }

      if ("pointSize" in material) {
        material.pointSize = paneParams.pointSize;
      }

      if ("offsetDepth" in material) {
        material.offsetDepth = paneParams.offsetDepth;
      }

      view.updateLayerById(layerId, {
        type: layer.type,
        data: layer.data,
        [paneParams.material]: material,
      });
    }
  }
};

function createParamCtrl(
  pane: Pane,
  paneParams: Record<string, any>,
  layer: MaterialLayerDescription | undefined,
  changeFunc: () => void,
) {
  if (!layer) {
    return undefined;
  }

  const material = layer[paneParams.material as keyof typeof layer];
  if (material) {
    const f = pane.addFolder({
      title: "",
      expanded: true,
    });

    paneParams.show = material.show ?? true;
    f.addBinding(paneParams, "show").on("change", changeFunc);

    if ("color" in material) {
      const colorValue = material.color.toHex();
      paneParams.color = "#" + colorValue.toString(16).padStart(6, "0");
      f.addBinding(paneParams, "color").on("change", (ev) => {
        if (ev.last) {
          changeFunc();
        }
      });
    }

    if ("opacity" in material) {
      paneParams.opacity = material.opacity;
      f.addBinding(paneParams, "opacity", {
        min: 0,
        max: 1,
      }).on("change", changeFunc);
    }

    if ("size" in material) {
      paneParams.size = material.size;
      f.addBinding(paneParams, "size").on("change", changeFunc);
    }

    if ("width" in material) {
      paneParams.width = material.width;
      f.addBinding(paneParams, "width").on("change", changeFunc);
    }

    if ("maxWidth" in material) {
      paneParams.maxWidth = material.maxWidth;
      f.addBinding(paneParams, "maxWidth", { min: 1 }).on("change", changeFunc);
    }

    if ("height" in material) {
      paneParams.height = material.height;
      f.addBinding(paneParams, "height").on("change", changeFunc);
    }

    if ("extrudedHeight" in material) {
      paneParams.extrudedHeight = material.extrudedHeight;
      f.addBinding(paneParams, "extrudedHeight").on("change", changeFunc);
    }

    if ("clampToGround" in material) {
      paneParams.clampToGround = material.clampToGround;
      f.addBinding(paneParams, "clampToGround").on("change", changeFunc);
    }

    if ("useGroundNormals" in material) {
      paneParams.useGroundNormals = material.useGroundNormals;
      f.addBinding(paneParams, "useGroundNormals").on("change", changeFunc);
    }

    if ("wireframe" in material) {
      paneParams.wireframe = material.wireframe;
      f.addBinding(paneParams, "wireframe").on("change", changeFunc);
    }

    if ("scaleByDistance" in material) {
      paneParams.scaleByDistance = material.scaleByDistance;
      f.addBinding(paneParams, "scaleByDistance").on("change", changeFunc);
    }

    if ("shouldRotateInDefault" in material) {
      paneParams.shouldRotateInDefault = material.shouldRotateInDefault;
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

    if ("font" in material) {
      paneParams.font = material.font;
      f.addBinding(paneParams, "font").on("change", changeFunc);
    }

    if ("backgroundColor" in material) {
      const colorValue = material.backgroundColor.toHex();
      paneParams.backgroundColor =
        "#" + colorValue.toString(16).padStart(6, "0");
      f.addBinding(paneParams, "backgroundColor").on("change", (ev) => {
        if (ev.last) {
          changeFunc();
        }
      });
    }

    if ("borderColor" in material) {
      const colorValue = material.borderColor.toHex();
      paneParams.borderColor = "#" + colorValue.toString(16).padStart(6, "0");
      f.addBinding(paneParams, "borderColor").on("change", (ev) => {
        if (ev.last) {
          changeFunc();
        }
      });
    }

    if ("borderWidth" in material) {
      paneParams.borderWidth = material.borderWidth;
      f.addBinding(paneParams, "borderWidth", { min: 0, max: 0.5 }).on(
        "change",
        changeFunc,
      );
    }

    if ("cornerRadius" in material) {
      paneParams.cornerRadius = material.cornerRadius;
      f.addBinding(paneParams, "cornerRadius", { min: 0, max: 0.5 }).on(
        "change",
        changeFunc,
      );
    }

    if ("center" in material) {
      paneParams.center.x = material.center.x;
      paneParams.center.y = material.center.y;
      f.addBinding(paneParams, "center").on("change", changeFunc);
    }

    if ("padding" in material) {
      paneParams.padding.x = material.padding.x;
      paneParams.padding.y = material.padding.y;
      f.addBinding(paneParams, "padding").on("change", changeFunc);
    }

    if ("transparent" in material) {
      paneParams.transparent = material.transparent;
      f.addBinding(paneParams, "transparent").on("change", changeFunc);
    }

    if ("outlineColor" in material) {
      const colorValue = material.outlineColor.toHex();
      paneParams.outlineColor = "#" + colorValue.toString(16).padStart(6, "0");
      f.addBinding(paneParams, "outlineColor").on("change", (ev) => {
        if (ev.last) {
          changeFunc();
        }
      });
    }

    if ("outlineShow" in material) {
      paneParams.outlineShow = material.outlineShow;
      f.addBinding(paneParams, "outlineShow").on("change", changeFunc);
    }

    if ("outlineWidth" in material) {
      paneParams.outlineWidth = material.outlineWidth;
      f.addBinding(paneParams, "outlineWidth", { min: 0, max: 20 }).on(
        "change",
        changeFunc,
      );
    }

    if ("outlineBlur" in material) {
      paneParams.outlineBlur = material.outlineBlur;
      f.addBinding(paneParams, "outlineBlur", { min: 0, max: 10 }).on(
        "change",
        changeFunc,
      );
    }

    if ("outlineOffset" in material) {
      paneParams.outlineOffset.x = material.outlineOffset.x;
      paneParams.outlineOffset.y = material.outlineOffset.y;
      f.addBinding(paneParams, "outlineOffset").on("change", changeFunc);
    }

    if ("outlineOpacity" in material) {
      paneParams.outlineOpacity = material.outlineOpacity;
      f.addBinding(paneParams, "outlineOpacity", { min: 0, max: 1 }).on(
        "change",
        changeFunc,
      );
    }

    if ("surfaceShow" in material) {
      paneParams.surfaceShow = material.surfaceShow;
      f.addBinding(paneParams, "surfaceShow").on("change", changeFunc);
    }

    if ("pointSize" in material) {
      paneParams.pointSize = material.pointSize;
      f.addBinding(paneParams, "pointSize", { min: 0, max: 10 }).on(
        "change",
        changeFunc,
      );
    }

    if ("offsetDepth" in material) {
      paneParams.offsetDepth = material.offsetDepth;
      f.addBinding(paneParams, "offsetDepth").on("change", changeFunc);
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
  if ("rasterTile" in layer) {
    materials.push("rasterTile");
  }
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

/**
 * A map of field names to their Tweakpane input binding APIs.
 * Used to access other field bindings within onChange/onMount callbacks.
 */
export type FieldsApis<Params extends object> = Record<
  keyof Params,
  InputBindingApi
>;

/**
 * Configuration for a single field in the folder.
 *
 * @template Params - The parameter object type containing all field values
 */
export type FolderField<Params extends object> = {
  [K in keyof Params]: {
    /** The property name in the params object */
    name: K;
    /** Optional Tweakpane binding parameters (min, max, step, options, etc.) */
    params?: BindingParams;
    /** Called after all bindings are created, useful for cross-field logic */
    onMount?: (apis: FieldsApis<Params>) => void;
    /** Called when the field value changes */
    onChange: (v: TpChangeEvent<Params[K]>, apis: FieldsApis<Params>) => void;
  };
}[keyof Params];

/**
 * Array of field configurations for addFieldsToFolder.
 */
export type FolderFields<Params extends object> = FolderField<Params>[];

/**
 * Adds multiple typed form fields to a Tweakpane folder.
 *
 * This helper simplifies creating complex control panels by providing:
 * - Type-safe field definitions based on the params object
 * - Access to all field APIs within change handlers
 * - Optional onMount callback for cross-field initialization
 *
 * @template Params - The parameter object type containing all field values
 * @param folder - The Tweakpane folder to add fields to
 * @param params - The parameter object containing field values
 * @param fields - Array of field configurations
 *
 * @example
 * ```typescript
 * import { Pane } from "tweakpane";
 * import { addFieldsToFolder } from "../../helpers/panel";
 *
 * const pane = new Pane({ title: "Controls" });
 * const folder = pane.addFolder({ title: "Polygon Settings" });
 *
 * const params = {
 *   opacity: 1.0,
 *   extrudedHeight: 100,
 *   wireframe: false,
 * };
 *
 * addFieldsToFolder(folder, params, [
 *   {
 *     name: "opacity",
 *     params: { min: 0, max: 1, step: 0.01 },
 *     onChange: ({ value }) => {
 *       layer.update({ polygon: { opacity: value } });
 *     },
 *   },
 *   {
 *     name: "extrudedHeight",
 *     params: { min: 0, max: 500, step: 10 },
 *     onChange: ({ value }) => {
 *       layer.update({ polygon: { extrudedHeight: value } });
 *     },
 *   },
 *   {
 *     name: "wireframe",
 *     onChange: ({ value }) => {
 *       layer.update({ polygon: { wireframe: value } });
 *     },
 *   },
 * ]);
 * ```
 */
export function addFieldsToFolder<Params extends object>(
  folder: FolderApi,
  params: Params,
  fields: FolderFields<Params>,
) {
  const fieldsApis = {} as FieldsApis<Params>;
  fields.forEach((field) => {
    const api = folder
      .addBinding(params, field.name, field.params)
      .on("change", (v) => field.onChange(v, fieldsApis));
    fieldsApis[field.name] = api as InputBindingApi;
  });
  fields.forEach((field) => field.onMount?.(fieldsApis));
}
