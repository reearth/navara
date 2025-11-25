import { getWGS84SemiMajorAxis, getWGS84Flattening } from "@navara/engine-api";
import ThreeView, {
  AmbientLightLayer,
  GlowSphereMeshLayer,
  LayerHandle,
} from "@navara/three";
import { Pane } from "tweakpane";

import { TILE_DATASETS } from "../../helpers/constants";
import { addCameraControl } from "../../helpers/control";

let gGlowSphereMeshLayer: LayerHandle<GlowSphereMeshLayer> | undefined =
  undefined;

const gPaneParams = {
  glowRadius: undefined as number | undefined,
  glowCoefficient: 0.5,
  glowExponent: 2.0,
  glowColor: 0x8cf3ff,
  glowOpacity: 0.5,
  visible: true,
};

export const run = async (view: ThreeView) => {
  await view.init();

  gPaneParams.glowRadius = getWGS84SemiMajorAxis() * 1.25;

  view.setCamera({
    lng: 90,
    lat: 0.1,
    height: 12600000,
    heading: 0,
    pitch: -90,
    roll: 0,
  });

  view.addLayer<AmbientLightLayer>({
    type: "light",
    ambient: {},
  });

  gGlowSphereMeshLayer = view.addLayer<GlowSphereMeshLayer>({
    type: "mesh",
    glowSphere: {
      radius: gPaneParams.glowRadius,
      coefficient: gPaneParams.glowCoefficient,
      exponent: gPaneParams.glowExponent,
      glowColor: gPaneParams.glowColor,
    },
    scale: { x: 1, y: 1, z: 1 - getWGS84Flattening() },
  });

  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    raster_tile: {
      max_zoom: 23,
    },
  });

  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });

  addCameraControl(view, pane);
  addPanel(view, pane);
};

function addPanel(view: ThreeView, pane: Pane) {
  if (!gGlowSphereMeshLayer) return;

  const folder = pane.addFolder({ title: "Glow Sphere Layer" });

  folder.addBinding(gPaneParams, "glowRadius").on("change", (ev) => {
    gGlowSphereMeshLayer?.update({
      glowSphere: {
        radius: ev.value,
      },
    });
  });

  folder.addBinding(gPaneParams, "glowCoefficient").on("change", (ev) => {
    gGlowSphereMeshLayer?.update({
      glowSphere: {
        coefficient: ev.value,
      },
    });
  });

  folder.addBinding(gPaneParams, "glowExponent").on("change", (ev) => {
    gGlowSphereMeshLayer?.update({
      glowSphere: {
        exponent: ev.value,
      },
    });
  });

  folder
    .addBinding(gPaneParams, "glowColor", { view: "color" })
    .on("change", (ev) => {
      gGlowSphereMeshLayer?.update({
        glowSphere: {
          glowColor: ev.value,
        },
      });
    });

  folder
    .addBinding(gPaneParams, "glowOpacity", { min: 0, max: 1 })
    .on("change", (ev) => {
      gGlowSphereMeshLayer?.update({
        glowSphere: {
          opacity: ev.value,
        },
      });
    });

  folder.addBinding(gPaneParams, "visible").on("change", (ev) => {
    if (gGlowSphereMeshLayer && gGlowSphereMeshLayer.visible !== undefined) {
      gGlowSphereMeshLayer.visible = ev.value;
    }
  });

  folder.addButton({ title: "Delete Layer" }).on("click", (ev) => {
    if (gGlowSphereMeshLayer) {
      gGlowSphereMeshLayer.delete();
      view.forceUpdate();
      gGlowSphereMeshLayer = undefined;
      ev.target.title = "Add Layer";
    } else {
      gGlowSphereMeshLayer = view.addLayer<GlowSphereMeshLayer>({
        type: "mesh",
        glowSphere: {
          radius: getWGS84SemiMajorAxis() * 1.25,
          coefficient: 0.5,
          exponent: 2.0,
          glowColor: 0x8cf3ff,
        },
        scale: { x: 1, y: 1, z: 1 - getWGS84Flattening() },
      });
      view.forceUpdate();
      ev.target.title = "Delete Layer";
    }
  });
}
