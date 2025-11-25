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
  glowRadiusScale: 1.25,
  glowCoefficient: 0.5,
  glowExponent: 2.0,
  glowColor: 0x8cf3ff,
  glowOpacity: 0.5,
  visible: true,
};

export const run = async (view: ThreeView) => {
  await view.init();

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
      radiusScale: gPaneParams.glowRadiusScale,
      coefficient: gPaneParams.glowCoefficient,
      exponent: gPaneParams.glowExponent,
      glowColor: gPaneParams.glowColor,
    },
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

  folder.addBinding(gPaneParams, "glowRadiusScale").on("change", (ev) => {
    gGlowSphereMeshLayer?.update({
      glowSphere: {
        radiusScale: ev.value,
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
          radiusScale: 1.25,
          coefficient: 0.5,
          exponent: 2.0,
          glowColor: 0x8cf3ff,
        },
      });
      view.forceUpdate();
      ev.target.title = "Delete Layer";
    }
  });
}
