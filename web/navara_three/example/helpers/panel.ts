import type { LayerDescription } from "@navara/three";
import type ThreeView from "@navara/three";
import { Pane } from "tweakpane";

export type MaterialLayerDescription = Exclude<
  LayerDescription,
  { type: "terrain" }
>;

export const addCtrlPanel = (
  layers: MaterialLayerDescription[],
  view: ThreeView,
) => {
  const layerMap = new Map<string, MaterialLayerDescription>();
  layers.forEach((layer) => {
    const layerId = view.addLayer(layer);
    if (layerId) {
      layerMap.set(layerId, layer);
    }
  });

  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });

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
      view.deleteLayer(layerIds[paneParams.layer]);
      layerDeleted[paneParams.layer] = 1;
      btnCtrl.title = "Add Layer";
    } else {
      const oldLayerId = layerIds[paneParams.layer];
      const layerDef = layerMap.get(oldLayerId);
      if (layerDef) {
        const newLayerId = view.addLayer(layerDef);
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
      const material = layer[paneParams.material as keyof typeof layer];

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
    const f = pane.addFolder({
      title: "",
      expanded: true,
    });

    paneParams.show = material.show ?? true;
    f.addBinding(paneParams, "show").on("change", changeFunc);

    if ("color" in material) {
      paneParams.color = "#" + material.color.toString(16).padStart(6, "0");
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
