import ThreeView, {
  Color,
  JAPAN_GSI_ELEVATION_DECODER,
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
import { Vector3, type WebGLRenderer, type WebGLRenderTarget } from "three";
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

  const bloomEffect = view.addLayer({
    type: "effect",
    selectiveBloom: {
      strength: 1.0,
      radius: 0.5,
      threshold: 0.0,
      debugViews: false,
      resolutionScale: 1.0,
    },
    selectiveEffectOcclusion: "normal",
  });

  const outlineEffect = view.addLayer({
    type: "effect",
    selectiveOutline: {
      color: new Color().setHex(0xff0000),
      thickness: 2.0,
      edgeStrength: 1.0,
      debugViews: false,
      resolutionScale: 1.0,
    },
    selectiveEffectOcclusion: "normal",
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

  // --- SE Buffer Debug View ---
  const renderer =
    view.renderPassOrchestrator.effectComposer.getRenderer() as WebGLRenderer;
  const gbufferRT = view.mrtPassLayer.ref.raw
    ?.gbufferRenderTarget as WebGLRenderTarget;

  const debugContainer = document.createElement("div");
  debugContainer.style.cssText =
    "position:absolute;top:0;left:0;display:flex;gap:2px;background:rgba(0,0,0,0.7);padding:2px;z-index:1000;";
  document.body.appendChild(debugContainer);

  function createDebugCanvas(label: string): {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    wrapper: HTMLDivElement;
  } {
    const wrapper = document.createElement("div");
    wrapper.style.textAlign = "center";
    const canvas = document.createElement("canvas");
    canvas.width = 150;
    canvas.height = 100;
    canvas.style.width = "150px";
    canvas.style.height = "100px";
    const labelEl = document.createElement("div");
    labelEl.textContent = label;
    labelEl.style.cssText = "color:white;font-size:10px;";
    wrapper.appendChild(canvas);
    wrapper.appendChild(labelEl);
    debugContainer.appendChild(wrapper);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2D context");
    return { canvas, ctx, wrapper };
  }

  const effectIdsView = createDebugCanvas("EffectIds (R=mask)");
  const silhouetteView = createDebugCanvas("Silhouette (G)");
  const emissiveView = createDebugCanvas("Emissive RGB");
  const emissiveAlphaView = createDebugCanvas("Emissive A");

  let debugViewEnabled = true;

  function renderDebugViews() {
    if (!debugViewEnabled || !gbufferRT) return;

    const w = gbufferRT.width;
    const h = gbufferRT.height;
    const gl = renderer.getContext();
    if (!(gl instanceof WebGL2RenderingContext)) return;

    const pixels = new Float32Array(w * h * 4);
    const prevTarget = renderer.getRenderTarget();

    renderer.setRenderTarget(gbufferRT);

    // EffectIds (attachment 2): R=bitmask, G=silhouette flag
    gl.readBuffer(gl.COLOR_ATTACHMENT0 + 2);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, pixels);
    drawToCanvas(effectIdsView, pixels, w, h, "bitmask");
    drawToCanvas(silhouetteView, pixels, w, h, "green");

    // Emissive (attachment 3)
    gl.readBuffer(gl.COLOR_ATTACHMENT0 + 3);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, pixels);
    drawToCanvas(emissiveView, pixels, w, h, "rgb");
    drawToCanvas(emissiveAlphaView, pixels, w, h, "alpha");

    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    renderer.setRenderTarget(prevTarget);
  }

  function drawToCanvas(
    view: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D },
    pixels: Float32Array,
    w: number,
    h: number,
    mode: "rgb" | "alpha" | "bitmask" | "green",
  ) {
    const cw = view.canvas.width;
    const ch = view.canvas.height;
    const imageData = view.ctx.createImageData(cw, ch);

    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const sx = Math.floor((x / cw) * w);
        const sy = Math.floor(((ch - 1 - y) / ch) * h); // flip Y
        const si = (sy * w + sx) * 4;
        const di = (y * cw + x) * 4;

        if (mode === "rgb") {
          imageData.data[di] = Math.min(255, pixels[si] * 255);
          imageData.data[di + 1] = Math.min(255, pixels[si + 1] * 255);
          imageData.data[di + 2] = Math.min(255, pixels[si + 2] * 255);
          imageData.data[di + 3] = 255;
        } else if (mode === "green") {
          // G channel: silhouette occlusion flag (0 or 1)
          const g = pixels[si + 1] > 0.5 ? 255 : 0;
          imageData.data[di] = 0;
          imageData.data[di + 1] = g;
          imageData.data[di + 2] = 0;
          imageData.data[di + 3] = 255;
        } else if (mode === "alpha") {
          const a = Math.min(255, pixels[si + 3] * 255);
          imageData.data[di] = a;
          imageData.data[di + 1] = a;
          imageData.data[di + 2] = a;
          imageData.data[di + 3] = 255;
        } else {
          // bitmask: visualize R channel as distinct colors per bit
          const mask = Math.round(pixels[si]);
          const colors = [
            [255, 0, 0],
            [0, 255, 0],
            [0, 0, 255],
            [255, 255, 0],
            [255, 0, 255],
            [0, 255, 255],
          ];
          let r = 0,
            g = 0,
            b = 0;
          for (let bit = 0; bit < 6; bit++) {
            if (mask & (1 << bit)) {
              r += colors[bit][0];
              g += colors[bit][1];
              b += colors[bit][2];
            }
          }
          imageData.data[di] = Math.min(255, r);
          imageData.data[di + 1] = Math.min(255, g);
          imageData.data[di + 2] = Math.min(255, b);
          imageData.data[di + 3] = mask > 0 ? 255 : 0;
        }
      }
    }
    view.ctx.putImageData(imageData, 0, 0);
  }

  // Hook into render loop
  const origRender = view.renderPassOrchestrator.effectComposer.render.bind(
    view.renderPassOrchestrator.effectComposer,
  );
  view.renderPassOrchestrator.effectComposer.render = (
    ...args: Parameters<typeof origRender>
  ) => {
    origRender(...args);
    renderDebugViews();
  };

  // --- Debug Controls ---
  const pane = new Pane({ title: "Selective Effect Debug" });

  const debugParams = { debugView: true };
  pane
    .addBinding(debugParams, "debugView", { label: "SE Buffer Debug" })
    .on("change", (ev) => {
      debugViewEnabled = ev.value;
      debugContainer.style.display = ev.value ? "flex" : "none";
    });

  // --- Mesh Emissive Controls ---
  const boxFolder = pane.addFolder({ title: "Box", expanded: true });
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

  const sphereFolder = pane.addFolder({ title: "Sphere", expanded: true });
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

  const cesiumFolder = pane.addFolder({
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
