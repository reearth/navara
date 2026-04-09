import ThreeView, { Color, Handle } from "@navara/three";
import {
  AmbientLightDeclaration,
  GlowGlobeMeshDeclaration,
} from "@navara/three_default_layers";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navara/three_default_plugin";
import { Pane } from "tweakpane";

import { TILE_DATASETS } from "../../helpers/constants";
import { addCameraControl } from "../../helpers/control";

let gGlowGlobeMeshDeclaration: Handle<GlowGlobeMeshDeclaration> | undefined =
  undefined;

const gPaneParams = {
  glowRadiusScale: 1.2,
  glowCoefficient: 0.3,
  glowExponent: 8.0,
  glowColor: 0x8cf3ff,
  glowOpacity: 0.5,
  visible: true,
};

export type LayerDescriptions = DefaultDescriptions;

export const run = async (view: ThreeView<LayerDescriptions>) => {
  const plugin = new DefaultPlugin();
  view.addPlugin(plugin);
  await view.init();

  view.addLayer<AmbientLightDeclaration>({
    type: "light",
    ambient: {},
  });

  gGlowGlobeMeshDeclaration = view.addLayer<GlowGlobeMeshDeclaration>({
    type: "mesh",
    glowGlobe: {
      radiusScale: gPaneParams.glowRadiusScale,
      coefficient: gPaneParams.glowCoefficient,
      exponent: gPaneParams.glowExponent,
      glowColor: new Color().setHex(gPaneParams.glowColor),
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

function addPanel(view: ThreeView<LayerDescriptions>, pane: Pane) {
  if (!gGlowGlobeMeshDeclaration) return;

  const folder = pane.addFolder({ title: "Glow Globe Layer" });

  folder.addBinding(gPaneParams, "glowRadiusScale").on("change", (ev) => {
    gGlowGlobeMeshDeclaration?.update({
      glowGlobe: {
        radiusScale: ev.value,
      },
    });
  });

  folder.addBinding(gPaneParams, "glowCoefficient").on("change", (ev) => {
    gGlowGlobeMeshDeclaration?.update({
      glowGlobe: {
        coefficient: ev.value,
      },
    });
  });

  folder.addBinding(gPaneParams, "glowExponent").on("change", (ev) => {
    gGlowGlobeMeshDeclaration?.update({
      glowGlobe: {
        exponent: ev.value,
      },
    });
  });

  folder
    .addBinding(gPaneParams, "glowColor", { view: "color" })
    .on("change", (ev) => {
      gGlowGlobeMeshDeclaration?.update({
        glowGlobe: {
          glowColor: new Color().setHex(ev.value),
        },
      });
    });

  folder
    .addBinding(gPaneParams, "glowOpacity", { min: 0, max: 1 })
    .on("change", (ev) => {
      gGlowGlobeMeshDeclaration?.update({
        glowGlobe: {
          opacity: ev.value,
        },
      });
    });

  folder.addBinding(gPaneParams, "visible").on("change", (ev) => {
    if (gGlowGlobeMeshDeclaration && gGlowGlobeMeshDeclaration.visible !== undefined) {
      gGlowGlobeMeshDeclaration.visible = ev.value;
    }
  });

  folder.addButton({ title: "Delete Layer" }).on("click", (ev) => {
    if (gGlowGlobeMeshDeclaration) {
      gGlowGlobeMeshDeclaration.delete();
      view.forceUpdate();
      gGlowGlobeMeshDeclaration = undefined;
      ev.target.title = "Add Layer";
    } else {
      gGlowGlobeMeshDeclaration = view.addLayer<GlowGlobeMeshDeclaration>({
        type: "mesh",
        glowGlobe: {
          radiusScale: gPaneParams.glowRadiusScale,
          coefficient: gPaneParams.glowCoefficient,
          exponent: gPaneParams.glowExponent,
          glowColor: new Color().setHex(gPaneParams.glowColor),
          opacity: gPaneParams.glowOpacity,
        },
      });
      view.forceUpdate();
      ev.target.title = "Delete Layer";
    }
  });
}
