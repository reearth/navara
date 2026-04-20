import ThreeView, { Color, MeshHandle } from "@navara/three";
import {
  AmbientLightDesc,
  GlowGlobeMeshDesc,
} from "@navara/three_default_layers";
import {
  DefaultPlugin,
  type DefaultDeclarations,
} from "@navara/three_default_plugin";
import { Pane } from "tweakpane";

import { TILE_DATASETS } from "../../helpers/constants";
import { addCameraControl } from "../../helpers/control";

let gGlowGlobeMeshDesc: MeshHandle<GlowGlobeMeshDesc> | undefined = undefined;

const gPaneParams = {
  glowRadiusScale: 1.2,
  glowCoefficient: 0.3,
  glowExponent: 8.0,
  glowColor: 0x8cf3ff,
  glowOpacity: 0.5,
  visible: true,
};

export type CustomDeclarations = DefaultDeclarations;

export const run = async (view: ThreeView<CustomDeclarations>) => {
  const plugin = new DefaultPlugin();
  view.addPlugin(plugin);
  await view.init();

  view.addLight<AmbientLightDesc>({
    ambient: {},
  });

  gGlowGlobeMeshDesc = view.addMesh<GlowGlobeMeshDesc>({
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

function addPanel(view: ThreeView<CustomDeclarations>, pane: Pane) {
  if (!gGlowGlobeMeshDesc) return;

  const folder = pane.addFolder({ title: "Glow Globe Descriptor" });

  folder.addBinding(gPaneParams, "glowRadiusScale").on("change", (ev) => {
    gGlowGlobeMeshDesc?.update({
      glowGlobe: {
        radiusScale: ev.value,
      },
    });
  });

  folder.addBinding(gPaneParams, "glowCoefficient").on("change", (ev) => {
    gGlowGlobeMeshDesc?.update({
      glowGlobe: {
        coefficient: ev.value,
      },
    });
  });

  folder.addBinding(gPaneParams, "glowExponent").on("change", (ev) => {
    gGlowGlobeMeshDesc?.update({
      glowGlobe: {
        exponent: ev.value,
      },
    });
  });

  folder
    .addBinding(gPaneParams, "glowColor", { view: "color" })
    .on("change", (ev) => {
      gGlowGlobeMeshDesc?.update({
        glowGlobe: {
          glowColor: new Color().setHex(ev.value),
        },
      });
    });

  folder
    .addBinding(gPaneParams, "glowOpacity", { min: 0, max: 1 })
    .on("change", (ev) => {
      gGlowGlobeMeshDesc?.update({
        glowGlobe: {
          opacity: ev.value,
        },
      });
    });

  folder.addBinding(gPaneParams, "visible").on("change", (ev) => {
    if (gGlowGlobeMeshDesc && gGlowGlobeMeshDesc.visible !== undefined) {
      gGlowGlobeMeshDesc.visible = ev.value;
    }
  });

  folder.addButton({ title: "Delete Descriptor" }).on("click", (ev) => {
    if (gGlowGlobeMeshDesc) {
      gGlowGlobeMeshDesc.delete();
      view.forceUpdate();
      gGlowGlobeMeshDesc = undefined;
      ev.target.title = "Add Descriptor";
    } else {
      gGlowGlobeMeshDesc = view.addMesh<GlowGlobeMeshDesc>({
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
