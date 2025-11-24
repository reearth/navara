import ThreeView, {
  AmbientLightLayer,
  GlowSphereMeshLayer,
  LayerHandle,
} from "@navara/three";
import { Pane } from "tweakpane";

import { TILE_DATASETS } from "../../helpers/constants";

let gGlowSphereMeshLayer: LayerHandle<GlowSphereMeshLayer> | undefined =
  undefined;

const gPaneParams = {
  glowRadius: 6378137 * 1.25,
  glowCoefficient: 0.5,
  glowExponent: 2.0,
  glowColor: { r: 0.549, g: 0.894, b: 1.0, a: 0.5 },
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
      radius: gPaneParams.glowRadius,
      coefficient: gPaneParams.glowCoefficient,
      exponent: gPaneParams.glowExponent,
      glowColor: gPaneParams.glowColor,
    },
    position: { x: 0, y: 0, z: 0 },
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
  addPanel(pane);
};

const addCameraControl = (view: ThreeView, pane: Pane) => {
  pane
    .addButton({
      title: "Globe view",
    })
    .on("click", () => {
      view.flyTo({
        lng: 90,
        lat: 0.1,
        height: 12600000,
        heading: 0,
        pitch: -90,
        roll: 0,
      });
    });

  pane
    .addButton({
      title: "Kakegawa castle view",
    })
    .on("click", () => {
      view.flyTo({
        lat: 34.7734947205,
        lng: 138.0163726807,
        height: 424.66,
        heading: 326.62109375,
        pitch: -56.2649879456,
        roll: 360.0,
      });
    });
};

function addPanel(pane: Pane) {
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

  folder.addBinding(gPaneParams, "glowColor").on("change", (ev) => {
    gGlowSphereMeshLayer?.update({
      glowSphere: {
        glowColor: ev.value,
      },
    });
  });
}
