import ThreeView, {
  Color,
  Effect,
  EffectDesc,
  degreeToRadian,
  geodeticToVector3,
  NORMAL_PACKING_SHADER,
  type EffectConfig,
  type EffectHandle,
  type EffectUpdate,
  type GBufferName,
} from "@navaramap/three";
import type {
  AmbientLightDesc,
  BoxMeshDesc,
  SelectiveBloomEffectDesc,
  SelectiveOutlineEffectDesc,
  SkyLightProbeDesc,
  SphereMeshDesc,
  SunLightDesc,
} from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { Effect as PostProcessingEffect } from "postprocessing";
import { Matrix4, Uniform, Vector3, type Camera, type Texture } from "three";
import { Pane } from "tweakpane";

import { TERRAIN_DATASETS, TILE_DATASETS } from "../../../helpers/constants";
import { atZoneTime } from "../../../helpers/control";

class ShadowDebugPPEffect extends PostProcessingEffect {
  constructor() {
    super(
      "ShadowDebugEffect",
      /* glsl */ `
        uniform sampler2D tShadow;
        void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
          float shadow = texture2D(tShadow, uv).r;
          outputColor = vec4(mix(inputColor.rgb, vec3(1.0, 0.0, 0.0), shadow * 0.8), inputColor.a);
        }
      `,
      { uniforms: new Map([["tShadow", new Uniform(null)]]) },
    );
  }

  setShadowTexture(texture: Texture | null): void {
    const uniform = this.uniforms.get("tShadow");
    if (uniform) {
      uniform.value = texture;
    }
  }
}

class ShadowDebug extends Effect<ShadowDebugPPEffect> {
  constructor(camera: Camera) {
    super(camera, new ShadowDebugPPEffect());
  }

  setShadowTexture(texture: Texture | null): void {
    this.rawEffect?.setShadowTexture(texture);
  }
}

type ShadowDebugDescription = { shadowDebug?: Record<string, never> };
type ShadowDebugEffectConfig = ShadowDebugDescription & EffectConfig;
type ShadowDebugEffectUpdate = ShadowDebugDescription & EffectUpdate;

class ShadowDebugEffectDesc extends EffectDesc<
  ShadowDebugEffectConfig,
  ShadowDebugEffectUpdate,
  ShadowDebug
> {
  static key = "shadowDebug";
  static insertBefore = ["toneMapping", "smaa", "fxaa", "final"];
  /** The whole point of this effect: makes the view allocate the buffer. */
  static requiredBuffers: readonly GBufferName[] = ["shadow"];

  createPass() {
    const camera = this.view.camera.raw;
    if (!camera) {
      throw new Error("Camera not available for the shadow debug effect");
    }
    return new ShadowDebug(camera);
  }

  update = (): void => {
    this._instance?.setShadowTexture(this.ctx.getShadowTexture() ?? null);
  };
}

type DeferredLightingUniforms = {
  normal: Texture | null;
  shadow: Texture | null;
  sunDirection: Vector3;
  sunColor: Vector3;
  ambientColor: Vector3;
  lightProbe: Vector3[];
  viewMatrix: Matrix4;
};

// Scratch values reused every frame so the per-frame update allocates nothing.
const ZERO_VECTOR = new Vector3();
const SCRATCH_SUN_COLOR = new Vector3();
const SCRATCH_AMBIENT_COLOR = new Vector3();
const SCRATCH_LIGHT_PROBE = Array.from({ length: 9 }, () => new Vector3());

class DeferredLightingPPEffect extends PostProcessingEffect {
  constructor() {
    super(
      "DeferredLightingEffect",
      /* glsl */ `
        // Navara's shared packing helpers (octahedral normal encoding).
        ${NORMAL_PACKING_SHADER}

        const float NVR_RECIPROCAL_PI = 0.3183098861837907;

        uniform sampler2D tNormal;
        uniform sampler2D tShadow;
        // View-space direction toward the sun (inherited from the sun desc).
        uniform vec3 sunDirection;
        uniform vec3 sunColor;
        uniform vec3 ambientColor;
        uniform vec3 lightProbe[9];
        uniform mat4 nvrViewMatrix;

        // Ref: https://github.com/mrdoob/three.js/blob/6a644fe0cc3220c7bebf6acc96bb7e49d3274980/src/renderers/shaders/ShaderChunk/lights_pars_begin.glsl.js#L13
        vec3 shGetIrradianceAt(in vec3 normal, in vec3 shCoefficients[9]) {
          float x = normal.x, y = normal.y, z = normal.z;
          vec3 result = shCoefficients[0] * 0.886227;
          result += shCoefficients[1] * 2.0 * 0.511664 * y;
          result += shCoefficients[2] * 2.0 * 0.511664 * z;
          result += shCoefficients[3] * 2.0 * 0.511664 * x;
          result += shCoefficients[4] * 2.0 * 0.429043 * x * y;
          result += shCoefficients[5] * 2.0 * 0.429043 * y * z;
          result += shCoefficients[6] * (0.743125 * z * z - 0.247708);
          result += shCoefficients[7] * 2.0 * 0.429043 * x * z;
          result += shCoefficients[8] * 0.429043 * (x * x - y * y);
          return result;
        }

        void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
          vec4 shadowSample = texture2D(tShadow, uv);
          // G is the albedo-output mask written by the G-buffer: only
          // pixels that skipped forward lighting get deferred shading.
          if (shadowSample.g < 0.5) {
            outputColor = inputColor;
            return;
          }
          // View-space normal, octahedral-encoded in RG (see gbufferLayout).
          vec3 normal = unpackVec2ToNormal(texture2D(tNormal, uv).rg);
          float shadow = shadowSample.r;

          float dotNL = clamp(dot(normal, normalize(sunDirection)), 0.0, 1.0);
          vec3 irradiance = dotNL * sunColor * (1.0 - shadow);

          vec3 worldNormal = normalize((vec4(normal, 0.0) * nvrViewMatrix).xyz);
          irradiance += ambientColor + shGetIrradianceAt(worldNormal, lightProbe);

          outputColor = vec4(inputColor.rgb * irradiance * NVR_RECIPROCAL_PI, inputColor.a);
        }
      `,
      {
        uniforms: new Map<string, Uniform>([
          ["tNormal", new Uniform(null)],
          ["tShadow", new Uniform(null)],
          ["sunDirection", new Uniform(new Vector3(0, 0, 1))],
          ["sunColor", new Uniform(new Vector3(1, 1, 1))],
          ["ambientColor", new Uniform(new Vector3(0, 0, 0))],
          [
            "lightProbe",
            new Uniform(Array.from({ length: 9 }, () => new Vector3())),
          ],
          ["nvrViewMatrix", new Uniform(new Matrix4())],
        ]),
      },
    );
  }

  updateUniforms(values: DeferredLightingUniforms): void {
    const u = this.uniforms;
    const tNormal = u.get("tNormal");
    const tShadow = u.get("tShadow");
    const sunDirection = u.get("sunDirection");
    const sunColor = u.get("sunColor");
    const ambientColor = u.get("ambientColor");
    const lightProbe = u.get("lightProbe");
    const viewMatrix = u.get("nvrViewMatrix");
    if (tNormal) tNormal.value = values.normal;
    if (tShadow) tShadow.value = values.shadow;
    if (sunDirection) (sunDirection.value as Vector3).copy(values.sunDirection);
    if (sunColor) (sunColor.value as Vector3).copy(values.sunColor);
    if (ambientColor) (ambientColor.value as Vector3).copy(values.ambientColor);
    if (lightProbe) {
      const target = lightProbe.value as Vector3[];
      for (let i = 0; i < target.length; i++) {
        target[i].copy(values.lightProbe[i] ?? ZERO_VECTOR);
      }
    }
    if (viewMatrix) (viewMatrix.value as Matrix4).copy(values.viewMatrix);
  }
}

class DeferredLighting extends Effect<DeferredLightingPPEffect> {
  constructor(camera: Camera) {
    super(camera, new DeferredLightingPPEffect());
  }

  updateUniforms(values: DeferredLightingUniforms): void {
    this.rawEffect?.updateUniforms(values);
  }
}

type DeferredLightingDescription = {
  deferredLighting?: Record<string, never>;
};
type DeferredLightingEffectConfig = DeferredLightingDescription & EffectConfig;
type DeferredLightingEffectUpdate = DeferredLightingDescription & EffectUpdate;

class DeferredLightingEffectDesc extends EffectDesc<
  DeferredLightingEffectConfig,
  DeferredLightingEffectUpdate,
  DeferredLighting
> {
  static key = "deferredLighting";
  static insertAfter = ["mrt"];
  static requiredBuffers: readonly GBufferName[] = ["shadow"];

  createPass() {
    const camera = this.view.camera.raw;
    if (!camera) {
      throw new Error("Camera not available for the deferred lighting effect");
    }
    return new DeferredLighting(camera);
  }

  update = (): void => {
    if (!this._instance) return;
    const camera = this.view.camera.raw;
    const sun = this.ctx.findLight<SunLightDesc>("sun");

    const ambient = this.ctx.findLight<AmbientLightDesc>("ambient");
    const skyLightProbe =
      this.ctx.findLight<SkyLightProbeDesc>("skyLightProbe");
    const sunDirection = this.view.atmosphere.sunDirection
      .clone()
      .transformDirection(camera.matrixWorldInverse);

    const sunLight = sun?.raw;
    const sunColor = sunLight
      ? SCRATCH_SUN_COLOR.set(
          sunLight.color.r,
          sunLight.color.g,
          sunLight.color.b,
        ).multiplyScalar(sunLight.intensity)
      : SCRATCH_SUN_COLOR.set(0, 0, 0);
    const ambientLight = ambient?.raw;
    const ambientColor = ambientLight
      ? SCRATCH_AMBIENT_COLOR.set(
          ambientLight.color.r,
          ambientLight.color.g,
          ambientLight.color.b,
        ).multiplyScalar(ambientLight.intensity)
      : SCRATCH_AMBIENT_COLOR.set(0, 0, 0);
    const probe = skyLightProbe?.raw;
    const probeIntensity = probe?.visible ? probe.intensity : 0;
    for (let i = 0; i < SCRATCH_LIGHT_PROBE.length; i++) {
      const coefficient = probe?.sh.coefficients[i];
      if (coefficient) {
        SCRATCH_LIGHT_PROBE[i].copy(coefficient).multiplyScalar(probeIntensity);
      } else {
        SCRATCH_LIGHT_PROBE[i].set(0, 0, 0);
      }
    }
    this._instance.updateUniforms({
      normal: this.ctx.getNormalTexture() ?? null,
      shadow: this.ctx.getShadowTexture() ?? null,
      sunDirection,
      sunColor,
      ambientColor,
      lightProbe: SCRATCH_LIGHT_PROBE,
      viewMatrix: camera.matrixWorldInverse,
    });
  };
}

export type CustomDescriptions =
  | DefaultDescriptions
  | { effect: ShadowDebugEffectConfig }
  | { effect: DeferredLightingEffectConfig };

export const run = async (view: ThreeView<CustomDescriptions>) => {
  const plugin = new DefaultPlugin();
  view.addPlugin(plugin);
  const attribution = view.attribution;
  await view.init();

  view.registerEffect("shadowDebug", ShadowDebugEffectDesc);
  view.registerEffect("deferredLighting", DeferredLightingEffectDesc);

  view.setCamera({
    lng: 139.767125,
    lat: 35.676,
    height: 800,
    heading: 0,
    pitch: -45,
    roll: 0,
  });

  const defaultAtmosphere = plugin.addDefaultPhotorealScene();
  defaultAtmosphere.sun.update({
    sun: { intensity: 1, castShadow: true, applyColor: true },
  });
  view.atmosphere.date = atZoneTime(view.atmosphere.date, 8);

  const terrainSource = view.addSource({
    type: "quantized-mesh",
    url: TERRAIN_DATASETS.reearthQuantizedMesh.url,
    maxZoom: 18,
    requestVertexNormals: true,
  });
  view.addLayer({
    type: "terrain",
    source: terrainSource,
    terrain: { castShadow: true, receiveShadow: true },
  });
  const osmSource = view.addSource({
    type: "raster-tile",
    url: TILE_DATASETS.openstreetmap.url,
    maxZoom: 23,
  });
  view.addLayer({
    type: "raster",
    source: osmSource,
  });
  attribution?.add([
    TILE_DATASETS.openstreetmap,
    TERRAIN_DATASETS.reearthQuantizedMesh,
  ]);

  const boxPosition = geodeticToVector3({
    lat: degreeToRadian(35.681236),
    lng: degreeToRadian(139.767125),
    height: 200,
  });

  // Blended path: transparent selective meshes share the MRT pass.
  const box = view.addMesh<BoxMeshDesc>({
    box: {
      width: 200,
      height: 200,
      depth: 200,
      color: new Color().setHex(0xff0000),
      emissiveColor: new Color().setHex(0xff0000),
      emissiveIntensity: 1.0,
      opacity: 0.9,
      transparent: true,
      castShadow: true,
      receiveShadow: true,
      effectIds: [],
    },
    position: boxPosition,
  });

  const spherePosition = geodeticToVector3({
    lat: degreeToRadian(35.68),
    lng: degreeToRadian(139.7715),
    height: 250,
  });

  const sphere = view.addMesh<SphereMeshDesc>({
    sphere: {
      radius: 100,
      color: new Color().setHex(0x00aaff),
      emissiveColor: new Color().setHex(0x0000ff),
      emissiveIntensity: 1.0,
      castShadow: true,
      receiveShadow: true,
      effectIds: [],
    },
    position: spherePosition,
  });

  let bloomEffect: EffectHandle<SelectiveBloomEffectDesc> | null = null;
  let outlineEffect: EffectHandle<SelectiveOutlineEffectDesc> | null = null;
  let shadowDebugEffect: EffectHandle<ShadowDebugEffectDesc> | null = null;
  let deferredEffect: EffectHandle<DeferredLightingEffectDesc> | null = null;

  const state = {
    bloom: false,
    outline: false,
    shadowDebug: false,
    deferred: true,
    lit: false,
    buffers: "",
  };

  const syncEffects = () => {
    const effectIds = [bloomEffect?.id, outlineEffect?.id].filter(
      (id): id is string => id !== undefined,
    );
    box.update({ box: { effectIds } });
    sphere.update({ sphere: { effectIds } });
    state.buffers = JSON.stringify(view.buffers);
    pane.refresh();
  };

  const pane = new Pane({ title: "G-buffer allocation" });

  pane.addBinding(state, "bloom").on("change", (ev) => {
    if (ev.value) {
      bloomEffect = view.addEffect<SelectiveBloomEffectDesc>({
        selectiveBloom: { strength: 1.0, radius: 0.5, threshold: 0.0 },
      });
    } else {
      bloomEffect?.delete();
      bloomEffect = null;
    }
    syncEffects();
  });

  pane.addBinding(state, "outline").on("change", (ev) => {
    if (ev.value) {
      outlineEffect = view.addEffect<SelectiveOutlineEffectDesc>({
        selectiveOutline: {
          color: new Color().setHex(0x00ff00),
          thickness: 2.0,
          edgeStrength: 1.0,
        },
      });
    } else {
      outlineEffect?.delete();
      outlineEffect = null;
    }
    syncEffects();
  });

  pane.addBinding(state, "shadowDebug").on("change", (ev) => {
    if (ev.value) {
      shadowDebugEffect = view.addEffect<ShadowDebugEffectDesc>({
        shadowDebug: {},
      });
    } else {
      shadowDebugEffect?.delete();
      shadowDebugEffect = null;
    }
    syncEffects();
  });

  pane.addBinding(state, "deferred").on("change", (ev) => {
    if (ev.value) {
      deferredEffect = view.addEffect<DeferredLightingEffectDesc>({
        deferredLighting: {},
      });
      view.lit = false;
    } else {
      deferredEffect?.delete();
      deferredEffect = null;
      view.lit = true;
    }
    state.lit = view.lit;
    syncEffects();
  });

  pane.addBinding(state, "lit").on("change", (ev) => {
    view.lit = ev.value;
  });

  pane.addBinding(state, "buffers", { readonly: true });

  syncEffects();
};
