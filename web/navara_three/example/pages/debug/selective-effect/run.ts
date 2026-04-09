import ThreeView, {
  BufferView,
  Color,
  JAPAN_GSI_ELEVATION_DECODER,
  SelectiveBloomEffectLayer,
  SelectiveOutlineEffectLayer,
  geodeticToVector3,
  degreeToRadian,
} from "@navara/three";
import type {
  BoxMeshLayer,
  SphereMeshLayer,
} from "@navara/three_default_layers";
import {
  DefaultPlugin,
  type DefaultLayerDescriptions,
} from "@navara/three_default_plugin";
import { Vector3, type WebGLRenderer } from "three";
import { Pane } from "tweakpane";

import { showAttributions } from "../../../helpers/attributions";
import {
  TILE_DATASETS,
  TILES_3D_DATASETS,
  TERRAIN_DATASETS,
} from "../../../helpers/constants";

export const run = async (view: ThreeView<DefaultLayerDescriptions>) => {
  const plugin = new DefaultPlugin();
  view.addPlugin(plugin);
  await view.init();

  // Camera: Tokyo Station area
  view.setCamera({
    lng: 139.7511145474829,
    lat: 35.67364356091717,
    height: 902.0,
    heading: 64.41840149763287,
    pitch: -36.00000121921312,
    roll: 0,
  });

  const defaultAtmosphere = plugin.addDefaultPhotorealLayers();
  defaultAtmosphere.sun.update({
    sun: { intensity: 1, castShadow: true },
  });

  const date = new Date();
  date.setHours(8);
  view.atmosphere.date = date;

  // --- Effect Layer definitions ---

  const bloomEffect = view.addLayer<SelectiveBloomEffectLayer>({
    type: "effect",
    selectiveBloom: {
      strength: 1.0,
      radius: 0.5,
      threshold: 0.0,
      resolutionScale: 1.0,
    },
  });

  const outlineEffect = view.addLayer<SelectiveOutlineEffectLayer>({
    type: "effect",
    selectiveOutline: {
      color: new Color().setHex(0xff0000),
      thickness: 2.0,
      edgeStrength: 1.0,
      resolutionScale: 1.0,
    },
  });

  // --- Mesh Layers (effectIds reference effect layer IDs) ---

  // Cube at Tokyo Station (bloom only)
  const boxPosition = geodeticToVector3({
    lat: degreeToRadian(35.6812),
    lng: degreeToRadian(139.7671),
    height: 200,
  });
  const boxLayer = view.addLayer<BoxMeshLayer>({
    type: "mesh",
    box: {
      width: 200,
      height: 200,
      depth: 200,
      color: new Color().setHex(0xff0000),
      emissiveColor: new Color().setHex(0xff0000),
      emissiveIntensity: 1.0,
      effectIds: [bloomEffect.id],
    },
    position: { x: boxPosition.x, y: boxPosition.y, z: boxPosition.z },
  });

  // Sphere near Tokyo Station (bloom + outline)
  const spherePosition = new Vector3(
    boxPosition.x,
    boxPosition.y,
    boxPosition.z,
  ).add(new Vector3(-500, 0, -600));
  const sphereLayer = view.addLayer<SphereMeshLayer>({
    type: "mesh",
    sphere: {
      radius: 150,
      color: new Color().setHex(0x0000ff),
      emissiveColor: new Color().setHex(0x0000ff),
      emissiveIntensity: 1.0,
      effectIds: [bloomEffect.id, outlineEffect.id],
    },
    position: { x: spherePosition.x, y: spherePosition.y, z: spherePosition.z },
  });

  // 3D Tiles: Chiyoda (outline only)
  const chiyodaLayer = view.addLayer({
    type: "cesium3dtiles",
    data: { url: TILES_3D_DATASETS.plateauChiyoda.url },
    model: {
      color: new Color().setHex(0xffffff),
      emissiveColor: new Color().setHex(0xffffff),
      emissiveIntensity: 0.0,
      effectIds: [outlineEffect.id],
    },
  });

  // 3D Tiles: Chuo (no effects)
  view.addLayer({
    type: "cesium3dtiles",
    data: { url: TILES_3D_DATASETS.plateauChuo.url },
    model: {
      color: new Color().setHex(0xffffff),
    },
  });

  // Base tiles
  view.addLayer({
    type: "tiles",
    data: { url: TILE_DATASETS.openstreetmap.url },
    rasterTile: { maxZoom: 23 },
  });

  // Terrain
  view.addLayer({
    type: "terrain",
    data: { url: TERRAIN_DATASETS.gsi.url },
    rasterTerrain: {
      elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
    },
  });

  showAttributions([
    TILE_DATASETS.openstreetmap,
    TERRAIN_DATASETS.gsi,
    TILES_3D_DATASETS.plateauChiyoda,
    TILES_3D_DATASETS.plateauChuo,
  ]);

  // --- SE Buffer Debug View (using BufferView) ---
  const renderer =
    view.renderPassOrchestrator.effectComposer.getRenderer() as WebGLRenderer;

  const effectIdsView = new BufferView(150, 100, {
    styleWidth: "150px",
    styleHeight: "100px",
  });
  const emissiveRgbView = new BufferView(150, 100, {
    styleWidth: "150px",
    styleHeight: "100px",
  });
  const emissiveAlphaView = new BufferView(150, 100, {
    styleWidth: "150px",
    styleHeight: "100px",
  });

  // Position views side by side
  effectIdsView.canvas.style.left = "0px";
  emissiveRgbView.canvas.style.left = "155px";
  emissiveAlphaView.canvas.style.left = "310px";

  let debugViewEnabled = true;

  /** Read a HalfFloat MRT attachment as Float32Array */
  function readMRTFloat(
    gbufferRT: { width: number; height: number },
    attachmentIndex: number,
  ): Float32Array | null {
    const gl = renderer.getContext();
    if (!(gl instanceof WebGL2RenderingContext)) return null;

    const w = gbufferRT.width;
    const h = gbufferRT.height;
    const pixels = new Float32Array(w * h * 4);
    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(
      view.mrtPassLayer.ref.raw?.gbufferRenderTarget ?? null,
    );
    gl.readBuffer(gl.COLOR_ATTACHMENT0 + attachmentIndex);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, pixels);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    renderer.setRenderTarget(prevTarget);
    return pixels;
  }

  /** Convert float pixels to Uint8Array with bitmask color visualization */
  function bitmaskToRgba(
    floatPixels: Float32Array,
    pixelCount: number,
  ): Uint8Array {
    const result = new Uint8Array(pixelCount * 4);
    const bitColors = [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [255, 255, 0],
      [255, 0, 255],
      [0, 255, 255],
    ];
    for (let p = 0; p < pixelCount; p++) {
      const mask = Math.round(floatPixels[p * 4]); // R channel = bitmask
      let r = 0,
        g = 0,
        b = 0;
      for (let bit = 0; bit < bitColors.length; bit++) {
        if (mask & (1 << bit)) {
          r += bitColors[bit][0];
          g += bitColors[bit][1];
          b += bitColors[bit][2];
        }
      }
      const di = p * 4;
      result[di] = Math.min(255, r);
      result[di + 1] = Math.min(255, g);
      result[di + 2] = Math.min(255, b);
      result[di + 3] = mask > 0 ? 255 : 0;
    }
    return result;
  }

  /** Convert float pixels to Uint8Array RGB (clamped 0-255) */
  function floatRgbToRgba(
    floatPixels: Float32Array,
    pixelCount: number,
  ): Uint8Array {
    const result = new Uint8Array(pixelCount * 4);
    for (let p = 0; p < pixelCount; p++) {
      const si = p * 4;
      const di = p * 4;
      result[di] = Math.min(
        255,
        Math.max(0, Math.round(floatPixels[si] * 255)),
      );
      result[di + 1] = Math.min(
        255,
        Math.max(0, Math.round(floatPixels[si + 1] * 255)),
      );
      result[di + 2] = Math.min(
        255,
        Math.max(0, Math.round(floatPixels[si + 2] * 255)),
      );
      result[di + 3] = 255;
    }
    return result;
  }

  /** Convert float A channel to grayscale Uint8Array */
  function floatAlphaToRgba(
    floatPixels: Float32Array,
    pixelCount: number,
  ): Uint8Array {
    const result = new Uint8Array(pixelCount * 4);
    for (let p = 0; p < pixelCount; p++) {
      const a = Math.min(
        255,
        Math.max(0, Math.round(floatPixels[p * 4 + 3] * 255)),
      );
      const di = p * 4;
      result[di] = a;
      result[di + 1] = a;
      result[di + 2] = a;
      result[di + 3] = 255;
    }
    return result;
  }

  function renderDebugViews() {
    if (!debugViewEnabled) return;
    const gbufferRT = view.mrtPassLayer.ref.raw?.gbufferRenderTarget;
    if (!gbufferRT) return;
    const w = gbufferRT.width;
    const h = gbufferRT.height;

    // EffectIds (attachment 2): bitmask color visualization
    const effectIdsFloat = readMRTFloat(gbufferRT, 2);
    if (effectIdsFloat) {
      effectIdsView.renderFromPixels(
        bitmaskToRgba(effectIdsFloat, w * h),
        w,
        h,
      );
    }

    // Emissive (attachment 3): RGB + Alpha visualization
    const emissiveFloat = readMRTFloat(gbufferRT, 3);
    if (emissiveFloat) {
      emissiveRgbView.renderFromPixels(
        floatRgbToRgba(emissiveFloat, w * h),
        w,
        h,
      );
      emissiveAlphaView.renderFromPixels(
        floatAlphaToRgba(emissiveFloat, w * h),
        w,
        h,
      );
    }
  }

  // Hook into CustomRenderPass.render (not EffectComposer.render)
  // gbufferRT framebuffer is only reliably readable right after CustomRenderPass renders
  const customRenderPass = view.mrtPassLayer.ref.raw;
  if (customRenderPass) {
    const origRender = customRenderPass.render.bind(customRenderPass);
    customRenderPass.render = (...args: Parameters<typeof origRender>) => {
      origRender(...args);
      renderDebugViews();
    };
  }

  // --- Debug Controls ---
  const pane = new Pane({ title: "Selective Effect Debug" });

  const debugParams = { debugView: true };
  pane
    .addBinding(debugParams, "debugView", { label: "SE Buffer Debug" })
    .on("change", (ev) => {
      debugViewEnabled = ev.value;
      effectIdsView.canvas.style.display = ev.value ? "block" : "none";
      emissiveRgbView.canvas.style.display = ev.value ? "block" : "none";
      emissiveAlphaView.canvas.style.display = ev.value ? "block" : "none";
    });

  // --- Effect Layer Controls ---
  const effectFolder = pane.addFolder({ title: "Effects", expanded: true });
  const bloomFolder = effectFolder.addFolder({
    title: "Bloom",
    expanded: true,
  });
  const bloomParams = {
    strength: 1.0,
    radius: 0.5,
    threshold: 0.0,
  };
  bloomFolder
    .addBinding(bloomParams, "strength", {
      label: "Strength",
      min: 0,
      max: 3,
      step: 0.1,
    })
    .on("change", (ev) => {
      bloomEffect.update({ selectiveBloom: { strength: ev.value } });
    });
  bloomFolder
    .addBinding(bloomParams, "radius", {
      label: "Radius",
      min: 0,
      max: 1,
      step: 0.05,
    })
    .on("change", (ev) => {
      bloomEffect.update({ selectiveBloom: { radius: ev.value } });
    });
  bloomFolder
    .addBinding(bloomParams, "threshold", {
      label: "Threshold",
      min: 0,
      max: 1,
      step: 0.05,
    })
    .on("change", (ev) => {
      bloomEffect.update({ selectiveBloom: { threshold: ev.value } });
    });

  const outlineFolder = effectFolder.addFolder({
    title: "Outline",
    expanded: true,
  });
  const outlineParams = {
    color: "#ff0000",
    thickness: 2.0,
    edgeStrength: 1.0,
  };
  outlineFolder
    .addBinding(outlineParams, "color", { label: "Color" })
    .on("change", (ev) => {
      outlineEffect.update({
        selectiveOutline: { color: new Color().setStyle(ev.value) },
      });
    });
  outlineFolder
    .addBinding(outlineParams, "thickness", {
      label: "Thickness",
      min: 0,
      max: 5,
      step: 0.5,
    })
    .on("change", (ev) => {
      outlineEffect.update({ selectiveOutline: { thickness: ev.value } });
    });
  outlineFolder
    .addBinding(outlineParams, "edgeStrength", {
      label: "Edge Strength",
      min: 0,
      max: 3,
      step: 0.1,
    })
    .on("change", (ev) => {
      outlineEffect.update({ selectiveOutline: { edgeStrength: ev.value } });
    });

  // --- Mesh Emissive Controls ---
  const meshFolder = pane.addFolder({ title: "Meshes", expanded: true });
  const boxFolder = meshFolder.addFolder({ title: "Box", expanded: true });
  const boxParams = {
    emissiveColor: "#ff0000",
    emissiveIntensity: 1.0,
  };
  boxFolder
    .addBinding(boxParams, "emissiveColor", { label: "Emissive Color" })
    .on("change", (ev) => {
      boxLayer.update({
        box: { emissiveColor: new Color().setStyle(ev.value) },
      });
    });
  boxFolder
    .addBinding(boxParams, "emissiveIntensity", {
      label: "Intensity",
      min: 0,
      max: 2,
      step: 0.1,
    })
    .on("change", (ev) => {
      boxLayer.update({ box: { emissiveIntensity: ev.value } });
    });

  const sphereFolder = meshFolder.addFolder({
    title: "Sphere",
    expanded: true,
  });
  const sphereParams = {
    emissiveColor: "#0000ff",
    emissiveIntensity: 1.0,
  };
  sphereFolder
    .addBinding(sphereParams, "emissiveColor", { label: "Emissive Color" })
    .on("change", (ev) => {
      sphereLayer.update({
        sphere: { emissiveColor: new Color().setStyle(ev.value) },
      });
    });
  sphereFolder
    .addBinding(sphereParams, "emissiveIntensity", {
      label: "Intensity",
      min: 0,
      max: 2,
      step: 0.1,
    })
    .on("change", (ev) => {
      sphereLayer.update({ sphere: { emissiveIntensity: ev.value } });
    });

  const cesiumFolder = meshFolder.addFolder({
    title: "Cesium3D Chiyoda",
    expanded: true,
  });
  const cesiumParams = {
    emissiveColor: "#ffffff",
    emissiveIntensity: 0.0,
  };
  cesiumFolder
    .addBinding(cesiumParams, "emissiveColor", { label: "Emissive Color" })
    .on("change", (ev) => {
      view.updateLayerById(chiyodaLayer.id, {
        model: { emissiveColor: new Color().setStyle(ev.value) },
      });
    });
  cesiumFolder
    .addBinding(cesiumParams, "emissiveIntensity", {
      label: "Intensity",
      min: 0,
      max: 2,
      step: 0.1,
    })
    .on("change", (ev) => {
      view.updateLayerById(chiyodaLayer.id, {
        model: { emissiveIntensity: ev.value },
      });
    });
};
