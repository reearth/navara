import ThreeView, {
  AmbientLightLayer,
  GlowGlobeMeshLayer,
  LayerHandle,
} from "@navara/three";
import { Pane } from "tweakpane";

import { TILE_DATASETS } from "../../helpers/constants";
import { addCameraControl } from "../../helpers/control";

let gGlowGlobeMeshLayer: LayerHandle<GlowGlobeMeshLayer> | undefined =
  undefined;

const gPaneParams = {
  glowRadiusScale: 1.2,
  glowCoefficient: 0.5,
  glowExponent: 5.0,
  glowColor: 0x8cf3ff,
  glowOpacity: 0.5,
  visible: true,
};

export const run = async (view: ThreeView) => {
  await view.init();

  view.addLayer<AmbientLightLayer>({
    type: "light",
    ambient: {},
  });

  gGlowGlobeMeshLayer = view.addLayer<GlowGlobeMeshLayer>({
    type: "mesh",
    glowGlobe: {
      radiusScale: gPaneParams.glowRadiusScale,
      coefficient: gPaneParams.glowCoefficient,
      exponent: gPaneParams.glowExponent,
      glowColor: gPaneParams.glowColor,
    },
  });

  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: {
      maxZoom: 23,
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
  if (!gGlowGlobeMeshLayer) return;

  const folder = pane.addFolder({ title: "Glow Globe Layer" });

  folder.addBinding(gPaneParams, "glowRadiusScale").on("change", (ev) => {
    gGlowGlobeMeshLayer?.update({
      glowGlobe: {
        radiusScale: ev.value,
      },
    });
  });

  folder.addBinding(gPaneParams, "glowCoefficient").on("change", (ev) => {
    gGlowGlobeMeshLayer?.update({
      glowGlobe: {
        coefficient: ev.value,
      },
    });
  });

  folder.addBinding(gPaneParams, "glowExponent").on("change", (ev) => {
    gGlowGlobeMeshLayer?.update({
      glowGlobe: {
        exponent: ev.value,
      },
    });
  });

  folder
    .addBinding(gPaneParams, "glowColor", { view: "color" })
    .on("change", (ev) => {
      gGlowGlobeMeshLayer?.update({
        glowGlobe: {
          glowColor: ev.value,
        },
      });
    });

  folder
    .addBinding(gPaneParams, "glowOpacity", { min: 0, max: 1 })
    .on("change", (ev) => {
      gGlowGlobeMeshLayer?.update({
        glowGlobe: {
          opacity: ev.value,
        },
      });
    });

  folder.addBinding(gPaneParams, "visible").on("change", (ev) => {
    if (gGlowGlobeMeshLayer && gGlowGlobeMeshLayer.visible !== undefined) {
      gGlowGlobeMeshLayer.visible = ev.value;
    }
  });

  folder.addButton({ title: "Delete Layer" }).on("click", (ev) => {
    if (gGlowGlobeMeshLayer) {
      gGlowGlobeMeshLayer.delete();
      view.forceUpdate();
      gGlowGlobeMeshLayer = undefined;
      ev.target.title = "Add Layer";
    } else {
      gGlowGlobeMeshLayer = view.addLayer<GlowGlobeMeshLayer>({
        type: "mesh",
        glowGlobe: {
          radiusScale: gPaneParams.glowRadiusScale,
          coefficient: gPaneParams.glowCoefficient,
          exponent: gPaneParams.glowExponent,
          glowColor: gPaneParams.glowColor,
          opacity: gPaneParams.glowOpacity,
        },
      });
      view.forceUpdate();
      ev.target.title = "Delete Layer";
    }
  });
}
