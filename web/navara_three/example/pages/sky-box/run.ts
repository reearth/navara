import ThreeView, { Color, MeshHandle, type BlendMode } from "@navara/three";
import {
  SunLightDesc,
  AmbientLightDesc,
  SkyBoxMeshDesc,
  StarsDesc,
  DEFAULT_SKY_BOX_OPTIONS,
  ColorGradingLUTEffectDesc,
  ToneMappingMode,
} from "@navara/three_default_layers";
import {
  DefaultPlugin,
  type DefaultDeclarations,
} from "@navara/three_default_plugin";
import { Pane } from "tweakpane";

import { TILE_DATASETS, LUT_DATASETS } from "../../helpers/constants";
import { addCameraControl, addDateControl } from "../../helpers/control";

let gSkyBoxMeshDesc: MeshHandle<SkyBoxMeshDesc> | undefined = undefined;

const gPaneParams = {
  visible: true,
  dayColor: DEFAULT_SKY_BOX_OPTIONS.dayColor.toHex(),
  nightColor: DEFAULT_SKY_BOX_OPTIONS.nightColor.toHex(),
  sunColor: DEFAULT_SKY_BOX_OPTIONS.sunColor.toHex(),
};

export type CustomDeclarations = DefaultDeclarations;

export const run = async (view: ThreeView<CustomDeclarations>) => {
  const plugin = new DefaultPlugin();
  view.addPlugin(plugin);
  await view.init();

  view.toneMappingExposure = 3;

  view.addEffect({
    toneMapping: {
      mode: ToneMappingMode.NEUTRAL,
    },
  });

  view.setCamera({
    lng: 139.920126569,
    lat: 35.778502146,
    height: 3791.96,
    heading: 231.9780466055,
    pitch: -11.97506891,
    roll: 360.0,
  });

  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: {
      maxZoom: 23,
    },
  });

  view.addLight<AmbientLightDesc>({
    ambient: {
      intensity: 0.1,
    },
  });

  view.addLight<SunLightDesc>({
    sun: {
      intensity: 1.0,
    },
  });

  view.addMesh<StarsDesc>({
    stars: {},
  });

  gSkyBoxMeshDesc = view.addMesh<SkyBoxMeshDesc>({
    skyBox: {
      dayColor: new Color().setHex(gPaneParams.dayColor),
      nightColor: new Color().setHex(gPaneParams.nightColor),
      sunColor: new Color().setHex(gPaneParams.sunColor),
    },
  });

  // adding color grading for better visuals
  view.addEffect<ColorGradingLUTEffectDesc>({
    colorGradingLUT: {
      url: LUT_DATASETS.Blackmagic4_6KFilmtoExtendedVideov4Cube.url,
      blendMode: "normal" as BlendMode,
      opacity: 1.0,
    },
    visible: true,
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
  if (!gSkyBoxMeshDesc) return;

  const folder = pane.addFolder({ title: "Sky Box Descriptor" });

  folder
    .addBinding(gPaneParams, "visible", { label: "Visible", view: "boolean" })
    .on("change", (ev) => {
      gSkyBoxMeshDesc?.update({
        visible: ev.value,
      });
    });

  folder
    .addBinding(gPaneParams, "dayColor", { label: "Day Color", view: "color" })
    .on("change", (ev) => {
      gSkyBoxMeshDesc?.update({
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
      gSkyBoxMeshDesc?.update({
        skyBox: {
          nightColor: new Color().setHex(ev.value),
        },
      });
    });

  folder
    .addBinding(gPaneParams, "sunColor", {
      label: "Sun Color",
      view: "color",
    })
    .on("change", (ev) => {
      gSkyBoxMeshDesc?.update({
        skyBox: {
          sunColor: new Color().setHex(ev.value),
        },
      });
    });
}
