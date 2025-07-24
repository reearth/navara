import type { LayerDescription } from "@navara/three";
import type ThreeView from "@navara/three";
import {
  FolderApi,
  Pane,
  TpChangeEvent,
  type BindingParams,
  type InputBindingApi,
} from "tweakpane";

export type MaterialLayerDescription = Exclude<
  LayerDescription,
  { type: "terrain" } | { type: "mesh" } | { type: "light" }
>;

export const addCtrlPanel = (
  layers: MaterialLayerDescription[],
  view: ThreeView,
) => {
  const layerMap = new Map<string, MaterialLayerDescription>();
  layers.forEach((layer) => {
    const layerId = view.addLayer(layer).id;
    if (layerId) {
      layerMap.set(layerId, layer);
    }
  });

  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });
  pane.element.style.position = "absolute";
  pane.element.style.width = "340px";
  pane.element.style.right = "0px";

  const layerIds = Array.from(layerMap.keys());
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
    opacity: 1,
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
    text: "",
    font: "",
    background_color: "#0a70c2",
    border_color: "#f8e43c",
    border_width: 0.0,
    corner_radius: 0.0,
    center: { x: 0, y: 0 },
    padding: { x: 0, y: 0 },
    transparent: false,
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
      layerDeleted[paneParams.layer] = 1;
      btnCtrl.title = "Add Layer";
    } else {
      const oldLayerId = layerIds[paneParams.layer];
      const layerDef = layerMap.get(oldLayerId);
      if (layerDef) {
        const newLayerId = view.addLayer(layerDef).id;
        if (newLayerId) {
          layerMap.set(newLayerId, layerDef);
          layerIds[paneParams.layer] = newLayerId;
          layerDeleted[paneParams.layer] = 0;
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
      const material = layer[paneParams.material as keyof typeof layer] as any;

      material.show = paneParams.show;

      if ("color" in material) {
        material.color = parseInt(paneParams.color.replace("#", ""), 16);
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

      if ("font" in material) {
        material.font = paneParams.font;
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

      if ("corner_radius" in material) {
        material.corner_radius = paneParams.corner_radius;
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

      view.updateLayerById(layerId, {
        type: layer.type,
        data: (layer as any).data,
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

  const material = layer[paneParams.material as keyof typeof layer] as any;
  if (material) {
    const f = pane.addFolder({
      title: "",
      expanded: true,
    });

    paneParams.show = material.show ?? true;
    f.addBinding(paneParams, "show").on("change", changeFunc);

    if ("color" in material) {
      paneParams.color = "#" + material.color.toString(16).padStart(6, "0");
      f.addBinding(paneParams, "color", { color: { type: "int" } }).on(
        "change",
        (ev) => {
          if (ev.last) {
            changeFunc();
          }
        },
      );
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

    if ("font" in material) {
      paneParams.font = material.font;
      f.addBinding(paneParams, "font").on("change", changeFunc);
    }

    if ("background_color" in material) {
      paneParams.background_color =
        "#" + material.background_color.toString(16).padStart(6, "0");
      f.addBinding(paneParams, "background_color", {
        color: { type: "int" },
      }).on("change", (ev) => {
        if (ev.last) {
          changeFunc();
        }
      });
    }

    if ("border_color" in material) {
      paneParams.border_color =
        "#" + material.border_color.toString(16).padStart(6, "0");
      f.addBinding(paneParams, "border_color", { color: { type: "int" } }).on(
        "change",
        (ev) => {
          if (ev.last) {
            changeFunc();
          }
        },
      );
    }

    if ("border_width" in material) {
      paneParams.border_width = material.border_width;
      f.addBinding(paneParams, "border_width", { min: 0, max: 0.5 }).on(
        "change",
        changeFunc,
      );
    }

    if ("corner_radius" in material) {
      paneParams.corner_radius = material.corner_radius;
      f.addBinding(paneParams, "corner_radius", { min: 0, max: 0.5 }).on(
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
  if ("raster_tile" in layer) {
    materials.push("raster_tile");
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

export type FieldsApis<Params extends object> = Record<
  keyof Params,
  InputBindingApi
>;

export type FolderField<Params extends object> = {
  [K in keyof Params]: {
    name: K;
    params?: BindingParams;
    onMount?: (apis: FieldsApis<Params>) => void;
    onChange: (v: TpChangeEvent<Params[K]>, apis: FieldsApis<Params>) => void;
  };
}[keyof Params];

export type FolderFields<Params extends object> = FolderField<Params>[];

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
