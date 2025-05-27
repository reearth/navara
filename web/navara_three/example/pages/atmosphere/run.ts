import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  ToneMappingMode,
} from "@navara/three";
import { Color, LightProbe, SphericalHarmonics3 } from "three";
import { Pane } from "tweakpane";

import { TERRAIN_URLS, TILE_URLS } from "../../helpers/constants";

import { SH_COEFFICIENTS } from "./consts";

export const run = async (view: ThreeView) => {
  await view.init();

  view.addLayer({
    type: "terrain",
    data: {
      url: TERRAIN_URLS.gsi,
    },
    raster_terrain: {
      max_zoom: 15,
      min_zoom: 5,
      elevation_decoder: JAPAN_GSI_ELEVATION_DECODER(),
    },
  });

  view.addLayer({
    type: "cesium3dtiles",
    data: {
      url: "https://assets.cms.plateau.reearth.io/assets/db/070026-aa27-431b-8d53-7cc6b03244f8/13101_chiyoda-ku_pref_2023_citygml_1_op_bldg_3dtiles_13101_chiyoda-ku_lod2_no_texture/tileset.json",
    },
    model: {
      show: true,
      id_property: "gml_id",
      color: 0xffffff,
      metalness: 0,
      roughness: 1,
    },
  });

  view.addLayer({
    type: "cesium3dtiles",
    data: {
      url: "https://assets.cms.plateau.reearth.io/assets/4c/f2436a-e2be-40e2-83da-f1781f36e30b/13102_chuo-ku_pref_2023_citygml_1_op_bldg_3dtiles_13102_chuo-ku_lod2_no_texture/tileset.json",
    },
    model: {
      show: true,
      id_property: "gml_id",
      color: 0xffffff,
      metalness: 0,
      roughness: 1,
    },
  });

  const pane = new Pane({
    title: "Parameters",
    expanded: true,
  });
  pane.element.style.maxHeight = "98vh";
  pane.element.style.overflow = "scroll";

  addCameraControl(view, pane);
  addTileControl(view, pane);
  addDateControl(view, pane);
  addAtmosphereControl(view, pane);
  addIBLControl(view, pane);
  addEffectsControl(view, pane);
};

const addCameraControl = (view: ThreeView, pane: Pane) => {
  pane
    .addButton({
      title: "Globe view",
    })
    .on("click", () => {
      view.setCamera({
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
      title: "Tokyo view",
    })
    .on("click", () => {
      view.setCamera({
        lng: 139.75711454748298,
        lat: 35.67564356091717,
        height: 902.0,
        heading: 64.41840149763287, // -180 to 180
        pitch: -36.00000121921312, // -180 to 0
        roll: 0, // -180 to 180
      });
    });
};

const addTileControl = (view: ThreeView, pane: Pane) => {
  const PARAMS = {
    type: TILE_URLS.gsiSeamlessphoto,
  };

  let layer = view.addLayer({
    type: "tiles",
    data: {
      url: PARAMS.type,
    },
    raster_tile: {},
  });

  const folder = pane.addFolder({
    title: "RasterTile",
  });

  folder
    .addBinding(PARAMS, "type", {
      options: TILE_URLS,
    })
    .on("change", (v) => {
      layer.delete();
      layer = view.addLayer({
        type: "tiles",
        data: {
          url: v.value,
        },
        raster_tile: {},
      });
    });
};

const addDateControl = (view: ThreeView, pane: Pane) => {
  const date = new Date();
  date.setHours(8);

  view.atmosphere.date = date;

  const PARAMS = {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    hour: date.getHours(),
  };

  const onChangeDate = () => {
    view.atmosphere.date = date;
  };

  const folder = pane.addFolder({
    title: "Date",
  });

  folder
    .addBinding(PARAMS, "year", {
      min: 1900,
      max: date.getFullYear(),
      step: 1,
    })
    .on("change", (v) => {
      date.setFullYear(v.value);
      onChangeDate();
    });
  folder
    .addBinding(PARAMS, "month", { min: 1, max: 12, step: 1 })
    .on("change", (v) => {
      date.setMonth(v.value - 1);
      onChangeDate();
    });
  folder
    .addBinding(PARAMS, "hour", { min: 0, max: 23, step: 1 })
    .on("change", (v) => {
      date.setHours(v.value);
      onChangeDate();
    });
};

const addAtmosphereControl = (view: ThreeView, pane: Pane) => {
  const PARAMS = {
    aerialPerspective: true,
    sky: true,
    sun: true,
    moon: true,
    sunLight: true,
    sunLightColor: "#FFFFFF",
    sunLightIntensity: 1,
    ambientLight: false,
    ambientLightColor: "#FFFFFF",
    ambientLightIntensity: 1,
    photometric: true,
    inscatter: true,
    transmittance: true,
  };

  const folder = pane.addFolder({
    title: "Atmosphere",
  });

  folder.addBinding(PARAMS, "aerialPerspective").on("change", (v) => {
    view.atmosphere.aerialPerspective = v.value;
  });
  folder.addBinding(PARAMS, "sky").on("change", (v) => {
    view.atmosphere.sky = v.value;
  });
  folder.addBinding(PARAMS, "sun").on("change", (v) => {
    view.atmosphere.sun = v.value;
  });
  folder.addBinding(PARAMS, "moon").on("change", (v) => {
    view.atmosphere.moon = v.value;
  });
  folder.addBinding(PARAMS, "sunLight").on("change", (v) => {
    view.atmosphere.sunLight = v.value;
  });
  folder.addBinding(PARAMS, "sunLightColor").on("change", (v) => {
    view.atmosphere.sunLightColor = new Color(v.value);
  });
  folder.addBinding(PARAMS, "sunLightIntensity").on("change", (v) => {
    view.atmosphere.sunLightIntensity = v.value;
  });
  folder.addBinding(PARAMS, "ambientLight").on("change", (v) => {
    view.atmosphere.ambientLight = v.value;
  });
  folder.addBinding(PARAMS, "ambientLightColor").on("change", (v) => {
    view.atmosphere.ambientLightColor = new Color(v.value);
  });
  folder.addBinding(PARAMS, "ambientLightIntensity").on("change", (v) => {
    view.atmosphere.ambientLightIntensity = v.value;
  });
  folder.addBinding(PARAMS, "photometric").on("change", (v) => {
    view.atmosphere.photometric = v.value;
  });
  folder.addBinding(PARAMS, "inscatter").on("change", (v) => {
    view.atmosphere.inscatter = v.value;
  });
  folder.addBinding(PARAMS, "transmittance").on("change", (v) => {
    view.atmosphere.transmittance = v.value;
  });
};

// Advanced
const addIBLControl = (view: ThreeView, pane: Pane) => {
  const PARAMS = {
    enable: false,
    sh: "debug",
    intensity: 1,
  };

  const sh = new SphericalHarmonics3();
  sh.coefficients = SH_COEFFICIENTS.debug;
  const lightProbe = new LightProbe(sh);

  const folder = pane.addFolder({
    title: "Image-based lighting",
  });

  folder.addBinding(PARAMS, "enable").on("change", (v) => {
    if (v.value) {
      view.scene.add(lightProbe);
    } else {
      view.scene.remove(lightProbe);
    }
    view.forceUpdate();
  });
  folder
    .addBinding(PARAMS, "sh", {
      options: Object.fromEntries(
        Object.entries(SH_COEFFICIENTS).map(([k]) => [k, k]),
      ),
    })
    .on("change", (v) => {
      sh.coefficients =
        SH_COEFFICIENTS[v.value as keyof typeof SH_COEFFICIENTS];
      view.forceUpdate();
    });
  folder.addBinding(PARAMS, "intensity").on("change", (v) => {
    lightProbe.intensity = v.value;
    view.forceUpdate();
  });
};

const addEffectsControl = (view: ThreeView, pane: Pane) => {
  const PARAMS = {
    toneMapping: true,
    toneMappingMode: ToneMappingMode.AGX,
    toneMappingExposure: 10,
    lensFlare: true,
    lensFlareIntensity: 0.005,
    dithering: true,
    ssao: true,
    ssaoSamples: 16,
    ssaoRadius: 5,
    ssaoIntensity: 1,
    ssaoColor: "#000000",
  };

  view.toneMappingEffect.enabled = PARAMS.toneMapping;
  view.toneMappingExposure = PARAMS.toneMappingExposure;
  view.lensFlareEffect.enabled = PARAMS.lensFlare;
  view.lensFlareEffect.intensity = PARAMS.lensFlareIntensity;
  view.ditheringEffect.enabled = PARAMS.dithering;
  view.ssaoEffect.enabled = PARAMS.ssao;

  const folder = pane.addFolder({
    title: "Effects",
  });

  folder.addBinding(PARAMS, "toneMapping").on("change", (v) => {
    view.toneMappingEffect.enabled = v.value;
  });
  folder
    .addBinding(PARAMS, "toneMappingMode", {
      options: ToneMappingMode,
    })
    .on("change", (v) => {
      view.toneMappingEffect.mode = Number(v.value);
    });
  folder
    .addBinding(PARAMS, "toneMappingExposure", { min: 0, max: 20, steps: 1 })
    .on("change", (v) => {
      view.toneMappingExposure = v.value;
    });
  folder.addBinding(PARAMS, "lensFlare").on("change", (v) => {
    view.lensFlareEffect.enabled = v.value;
  });
  folder
    .addBinding(PARAMS, "lensFlareIntensity", { step: 0.001 })
    .on("change", (v) => {
      view.lensFlareEffect.intensity = v.value;
    });
  folder.addBinding(PARAMS, "dithering").on("change", (v) => {
    view.ditheringEffect.enabled = v.value;
  });
  folder.addBinding(PARAMS, "ssao").on("change", (v) => {
    view.ssaoEffect.enabled = v.value;
  });
  folder.addBinding(PARAMS, "ssaoSamples").on("change", (v) => {
    view.ssaoEffect.samples = v.value;
  });
  folder.addBinding(PARAMS, "ssaoRadius").on("change", (v) => {
    view.ssaoEffect.radius = v.value;
  });
  folder.addBinding(PARAMS, "ssaoIntensity").on("change", (v) => {
    view.ssaoEffect.intensity = v.value;
  });
  folder.addBinding(PARAMS, "ssaoColor").on("change", (v) => {
    view.ssaoEffect.color = new Color(v.value);
  });
};
