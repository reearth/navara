import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  ToneMappingMode,
} from "@navara/three";
import { Color } from "three";
import { Pane } from "tweakpane";

import { TERRAIN_URLS, TILE_URLS } from "../../helpers/constants";

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

  addCameraControl(view, pane);
  addTileControl(view, pane);
  addDateControl(view, pane);
  addAtmosphereControl(view, pane);
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

const addEffectsControl = (view: ThreeView, pane: Pane) => {
  const PARAMS = {
    toneMapping: true,
    toneMappingMode: ToneMappingMode.AGX,
    toneMappingExposure: 10,
    lensFlare: true,
    dithering: true,
  };

  view.toneMappingEffect.enabled = PARAMS.toneMapping;
  view.toneMappingExposure = PARAMS.toneMappingExposure;
  view.lensFlareEffect.enabled = PARAMS.lensFlare;
  view.ditheringEffect.enabled = PARAMS.dithering;

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
  folder.addBinding(PARAMS, "dithering").on("change", (v) => {
    view.ditheringEffect.enabled = v.value;
  });
};
