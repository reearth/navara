import ThreeView, {
  Color,
  type BlendMode,
  LayerHandle,
  JAPAN_GSI_ELEVATION_DECODER,
} from "@navara/three";
import {
  ColorGradingLUTEffectLayer,
  DEFAULT_COLOR_GRADING_LUT_OPTIONS,
} from "@navara/three_default_layers";
import {
  DefaultPlugin,
  type DefaultDeclarations,
} from "@navara/three_default_plugin";
import { Pane } from "tweakpane";

import { showAttributions } from "../../helpers/attributions";
import {
  TILE_DATASETS,
  TILES_3D_DATASETS,
  LUT_DATASETS,
  TERRAIN_DATASETS,
} from "../../helpers/constants";
import {
  addHidePaneKeyShortcut,
  addDateControl,
  addCameraControl,
} from "../../helpers/control";

let gColorGradingLUTLayer: LayerHandle<ColorGradingLUTEffectLayer>;

export type CustomDeclarations = DefaultDeclarations;

export const run = async (view: ThreeView<CustomDeclarations>) => {
  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);

  await view.init();

  const defaultAtmospheres = defaultPlugin.addDefaultPhotorealLayers();
  defaultAtmospheres.sun.update({
    sun: {
      intensity: 1,
      castShadow: true,
    },
  });

  view.toneMappingExposure = 10;

  gColorGradingLUTLayer = view.addEffect<ColorGradingLUTEffectLayer>({
    colorGradingLUT: { ...DEFAULT_COLOR_GRADING_LUT_OPTIONS },
    visible: true,
  });

  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.gsiSeamlessphoto.url },
    rasterTile: {
      maxZoom: 23,
    },
  });

  view.addLayer({
    type: "terrain",
    data: { url: TERRAIN_DATASETS.gsi.url },
    rasterTerrain: {
      maxZoom: 15,
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    },
  });

  view.addLayer({
    type: "cesium3dtiles",
    data: {
      url: TILES_3D_DATASETS.plateauChiyoda.url,
    },
    model: {
      show: true,
      color: new Color().setStyle("#ffffff"),
      metalness: 0.1,
      roughness: 0.1,
      castShadow: true,
      receiveShadow: true,
    },
  });

  const pane = new Pane({
    title: "Color Grading LUT Effect",
    expanded: true,
  });

  addHidePaneKeyShortcut(pane);

  const params = { ...DEFAULT_COLOR_GRADING_LUT_OPTIONS, show: true };

  pane
    .addBinding(params, "url", {
      options: {
        Blackmagic4_6KFilmtoExtendedVideov4Cube:
          LUT_DATASETS.Blackmagic4_6KFilmtoExtendedVideov4Cube.url,
        djangoCube: LUT_DATASETS.djangoCube.url,
        presetproCinematic3dl: LUT_DATASETS.presetproCinematic3dl.url,
        KodakE100GXEktachrome100PNG:
          LUT_DATASETS.KodakE100GXEktachrome100PNG.url,
        fuji160cPNG: LUT_DATASETS.fuji160cPNG.url,
        fuji800Z3PNG: LUT_DATASETS.fuji800Z3PNG.url,
        fujiFP100C7PNG: LUT_DATASETS.fujiFP100C7PNG.url,
        agfaVista200PNG: LUT_DATASETS.agfaVista200PNG.url,
        agfaColorUltra100PNG: LUT_DATASETS.agfaColorUltra100PNG.url,
        agfaPrecisa100PNG: LUT_DATASETS.agfaPrecisa100PNG.url,
      },
    })
    .on("change", (ev) => {
      gColorGradingLUTLayer.update({
        colorGradingLUT: { url: ev.value as string },
      });
    });

  pane
    .addBinding(params, "blendMode", {
      options: {
        skip: "skip",
        set: "set",
        add: "add",
        alpha: "alpha",
        average: "average",
        color: "color",
        colorBurn: "colorBurn",
        colorDodge: "colorDodge",
        darken: "darken",
        difference: "difference",
        divide: "divide",
        dst: "dst",
        exclusion: "exclusion",
        hardLight: "hardLight",
        hardMix: "hardMix",
        hue: "hue",
        invert: "invert",
        invertRgb: "invertRgb",
        lighten: "lighten",
        linearBurn: "linearBurn",
        linearDodge: "linearDodge",
        linearLight: "linearLight",
        luminosity: "luminosity",
        multiply: "multiply",
        negation: "negation",
        normal: "normal",
        overlay: "overlay",
        pinLight: "pinLight",
        reflect: "reflect",
        saturation: "saturation",
        screen: "screen",
        softLight: "softLight",
        src: "src",
        subtract: "subtract",
        vividLight: "vividLight",
      },
    })
    .on("change", (ev) => {
      gColorGradingLUTLayer.update({
        colorGradingLUT: { blendMode: ev.value as BlendMode },
      });
    });

  pane.addBinding(params, "opacity", { min: 0, max: 1 }).on("change", (ev) => {
    gColorGradingLUTLayer.update({ colorGradingLUT: { opacity: ev.value } });
  });

  pane.addBinding(params, "show").on("change", (ev) => {
    gColorGradingLUTLayer.update({ visible: ev.value });
  });

  addDateControl(view, pane);
  addCameraControl(view, pane);
  showAttributions([TILE_DATASETS.openstreetmap]);
};
