import ThreeView, {
  Color,
  SkyBoxMeshLayer,
  LayerHandle,
  SunLightLayer,
  StarsLayer,
  AmbientLightLayer,
  ColorGradingLUTEffectLayer,
  type BlendMode,
} from "@navara/three";
import { Pane } from "tweakpane";

import { TILE_DATASETS, LUT_DATASETS } from "../../helpers/constants";
import { addCameraControl, addDateControl } from "../../helpers/control";

let gSkyBoxMeshLayer: LayerHandle<SkyBoxMeshLayer> | undefined = undefined;

const gPaneParams = {
  visible: true,
  dayColor: 0x87ceeb,
  nightColor: 0x000033,
  sunsetColor: 0xffddae,
};

export const run = async (view: ThreeView) => {
  await view.init();

  view.addLayer<AmbientLightLayer>({
    type: "light",
    ambient: {
      intensity: 0.1,
    },
  });

  view.addLayer<SunLightLayer>({
    type: "light",
    sun: {
      intensity: 1.0,
    },
  });

  view.addLayer<StarsLayer>({
    type: "mesh",
    stars: {},
  });

  gSkyBoxMeshLayer = view.addLayer<SkyBoxMeshLayer>({
    type: "mesh",
    skyBox: {
      dayColor: new Color().setHex(gPaneParams.dayColor),
      nightColor: new Color().setHex(gPaneParams.nightColor),
    },
  });

  // adding color grading for better visuals
  view.addLayer<ColorGradingLUTEffectLayer>({
    type: "effect",
    colorGradingLUT: {
      url: LUT_DATASETS.Blackmagic4_6KFilmtoExtendedVideov4Cube.url,
      blendMode: "normal" as BlendMode,
      opacity: 1.0,
    },
    visible: true,
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
  addPanel(pane);
  addDateControl(view, pane);
};

function addPanel(pane: Pane) {
  if (!gSkyBoxMeshLayer) return;

  const folder = pane.addFolder({ title: "Sky Box Layer" });

  folder
    .addBinding(gPaneParams, "visible", { label: "Visible", view: "boolean" })
    .on("change", (ev) => {
      gSkyBoxMeshLayer?.update({
        visible: ev.value,
      });
    });

  folder
    .addBinding(gPaneParams, "dayColor", { label: "Day Color", view: "color" })
    .on("change", (ev) => {
      gSkyBoxMeshLayer?.update({
        skyBox: {
          dayColor: new Color().setHex(ev.value),
        },
      });
    });

  folder
    .addBinding(gPaneParams, "nightColor", {
      label: "Night Color",
      view: "color",
    })
    .on("change", (ev) => {
      gSkyBoxMeshLayer?.update({
        skyBox: {
          nightColor: new Color().setHex(ev.value),
        },
      });
    });

  folder
    .addBinding(gPaneParams, "sunsetColor", {
      label: "Sunset Color",
      view: "color",
    })
    .on("change", (ev) => {
      gSkyBoxMeshLayer?.update({
        skyBox: {
          sunsetColor: new Color().setHex(ev.value),
        },
      });
    });
}
