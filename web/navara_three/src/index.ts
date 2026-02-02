import { EventManager, EventHandler, Globe } from "@navara/core";
import type {
  CameraPosition,
  ColorMap,
  GlobeOptions,
  Nullable,
  XYZ,
  Color as CoreColor,
  LatLngHeight,
  LatLng,
} from "@navara/core";
import initCore, {
  Core,
  CameraDirection,
  LLE,
  type TerrainHeightUpdatedEvent,
  type TextureFragmentStatus,
} from "@navara/engine";
import { initNavaraApi } from "@navara/three_api";
import { initializeWorkerPool } from "@navara/worker";
import {
  Scene,
  WebGLRenderer,
  Vector3,
  Texture,
  Vector2,
  LinearFilter,
  ClampToEdgeWrapping,
  RepeatWrapping,
  Group,
  Material,
  PCFSoftShadowMap,
} from "three";
import invariant from "tiny-invariant";

import { Atmosphere, type AtmosphereOptions } from "./atmosphere";
import { ThreeViewCamera } from "./camera";
import { Color } from "./Color";
import { createDefaultConcurrencyManager } from "./concurrency";
import { WATER_NORMAL_URL } from "./constants/assets";
import {
  LayerDeclaration,
  ViewContext,
  SelectiveEffectHelper,
  type MeshLayerConstructor,
  type LightLayerConstructor,
  type EffectLayerConstructor,
} from "./core";
import { LayerHandle } from "./core/LayerHandle";
import { Registries } from "./core/Registries";
import { getDevicePixelRatio, isMobileDevice } from "./device";
import {
  processEvent,
  type BufferLoader,
  type FeatureHandler,
  type GlobeHandler,
  type MeshHandler,
  type TextureFragmentHandler,
  type TileHandler,
  type WorkerTaskHandler,
} from "./event";
import { TEXTURE_LOADER } from "./event/loaders";
import { registerInputEvents } from "./input";
import { Layer, type LayerEvent } from "./layer";
import { SunLightLayer, AmbientLightLayer, SkyLightProbeLayer } from "./layers";
import {
  CloudsEffectLayer,
  FogLightEffectLayer,
  FXAAEffectLayer,
  LensFlareEffectLayer,
  MRTPassEffectLayer,
  SkyEnvMapEffectLayer,
  SMAAEffectLayer,
  SSAOEffectLayer,
  SSREffectLayer,
  SelectiveBloomEffectLayer,
  SelectiveOutlineEffectLayer,
  TestSelectiveEffectLayer,
  ToneMappingEffectLayer,
  RainDropEffectLayer,
  TransparentPassEffectLayer,
  DepthOfFieldEffectLayer,
  ColorGradingLUTEffectLayer,
} from "./layers/effect";
import { AerialPerspectiveEffectLayer } from "./layers/effect/AerialPerspectiveEffectLayer";
import { FinalCopyEffectLayer } from "./layers/effect/FinalCopyEffectLayer";
import { ArrowHelperLayer } from "./layers/helpers/ArrowHelperLayer";
import { AxesHelperLayer } from "./layers/helpers/AxesHelperLayer";
import { LightProbeLayer } from "./layers/light/LightProbeLayer";
import { ArclineMeshLayer } from "./layers/mesh/ArclineMeshLayer";
import { BoxMeshLayer } from "./layers/mesh/BoxMeshLayer";
import { CylinderMeshLayer } from "./layers/mesh/CylinderMeshLayer";
import { GlowGlobeMeshLayer } from "./layers/mesh/GlowGlobeMeshLayer";
import { GLTFModelLayer } from "./layers/mesh/GLTFModelLayer";
import { PlaneMeshLayer } from "./layers/mesh/PlaneMeshLayer";
import { RainMeshLayer } from "./layers/mesh/RainMeshLayer";
import { SkyBoxMeshLayer } from "./layers/mesh/SkyBoxMeshLayer";
import { SkyMeshLayer } from "./layers/mesh/SkyMeshLayer";
import { SmoothLineMeshLayer } from "./layers/mesh/SmoothLineMeshLayer";
import { SnowMeshLayer } from "./layers/mesh/SnowMeshLayer";
import { SphereMeshLayer } from "./layers/mesh/SphereMeshLayer";
import { StarsLayer } from "./layers/mesh/StarsLayer";
import { TubeMeshLayer } from "./layers/mesh/TubeMeshLayer";
import { LayersManager } from "./layersManager";
import { overrideMaterialsForMRT } from "./material";
import { RenderPassOrchestrator } from "./orchestrators/RenderPassOrchestrator";
import { PickHelper } from "./pick/pickHelper";
import { TerrainPicker } from "./pick/pickTerrain";
import { TexturizedSceneByTileCoordinates, type Scenes } from "./scene";
import { ShadowMapViewers } from "./ShadowMapViewers";
import { RendererStats } from "./stats";
import { warmUp } from "./tasks/warmUp";
import type { TextureOptions } from "./textures";
import {
  type AbortControllers,
  type LayerDescription as _ActualLayerDescription,
  type MeshCache,
  type PickedFeature,
  type WorkerPoolPromises,
  type RenderFlag,
  type TileMapByHandle,
  type MeshLayerDeclarationDescription,
  type LightLayerDeclarationDescription,
  type EffectLayerDeclarationDescription,
  type DrapedMaterialCache,
} from "./type";
import type { CommonUniforms } from "./uniforms";
import { isWorker, convertScreenPos } from "./utils";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
/** @ts-ignore ignore: https://v3.vitejs.dev/guide/features.html#import-with-query-suffixes  */
import WorkerURL from "./worker?url&worker";

export type { CameraOptions, CameraEvent } from "./camera";

export { ColorMap, type LUT, type ColorTuple } from "@navara/core";
export type { Nullable, XYZ, LatLng, LatLngHeight } from "@navara/core";
export * from "./type";
export * from "./constants";
export * from "./light";
export * from "./mesh";
export * from "./layer";
export * from "./effects";
export * from "./shaders";
export * from "./event/loaders";
export * from "./material";
export * from "./core";
export * from "./layers";
export * from "./lights";
export * from "./passes";
export * from "@navara/three_api";
export * from "./Color";
export {
  isMobileDevice,
  getDevicePixelRatio,
  type DevicePixelRatioOptions,
} from "./device";
export { type BlendMode } from "./utils/blendModes";
export { CameraDirection } from "@navara/engine";

// CSM exports for advanced users
export { CascadedShadowMaps, CSMHelper } from "@navara/three_csm";

// NOTE:
// This overrides all materials to output a normal buffer, meaning Navara operates using MRT (Multiple Render Targets).
// Currently, Navara requires two buffers, so your shader must output them.
overrideMaterialsForMRT();

/**
 * Configuration options for initializing ThreeView.
 */
export type Options = {
  /** Container element to append the canvas to. */
  container?: HTMLElement;
  /** Canvas element for rendering. If not provided, a new canvas is created. */
  canvas?: HTMLCanvasElement | OffscreenCanvas;
  /** Device pixel ratio override. Uses device default if not specified. */
  pixelRatio?: number;
  /** Disables automatic resize handling on window resize events. */
  disableAutoResize?: boolean;
  /** Enables debug mode with performance stats overlay. */
  debug?: boolean;
  /** Atmosphere rendering configuration options. */
  atmosphere?: AtmosphereOptions;
  /** Background color of the scene. Defaults to dark color (0x0a0a0f). */
  backgroundColor?: CoreColor;
  /** Feature picking configuration. */
  picking?: boolean;
  /** Selective post-processing effects configuration. */
  selectiveEffects?: {
    /** Enables debug views for selective effect masks. */
    debugViews?: boolean;
  };
  /** When true, renders every frame. When false, renders only on changes or when forceUpdate() is called. */
  animation?: boolean;
  /** Number of samples for MSAA (Multi-Sample Anti-Aliasing). 0 disables MSAA. */
  multisampling?: number;
  /** Uses half-float precision for post-processing. Higher quality when true. @defaultValue true */
  halfFloat?: boolean;
  /** Enables logarithmic depth buffer for improved depth precision at large scales. @defaultValue true */
  logarithmicDepthBuffer?: boolean;
  /** Enables shadow mapping. Must be set at initialization time. */
  shadow?: boolean;
  /** Enables mobile device optimizations such as lower pixel ratio. */
  mobileOptimization?: boolean;
  /**
   * Enables shared water texture. When enabled, a single water normal texture
   * is loaded once and shared across all meshes that have water effects enabled.
   */
  waterTexture?: {
    /** Whether to enable the shared water texture. */
    enabled: boolean;
    /** Custom water normal texture URL. Uses built-in texture if not specified. */
    url?: string;
  };
} & GlobeOptions;

/**
 * Mouse event extended with map coordinates at the event location.
 */
export type MapMouseEvent = {
  /** World coordinates (ECEF) at the mouse position on the globe surface. */
  map: XYZ;
} & MouseEvent;

/**
 * Event types emitted by ThreeView. Subscribe using `view.on(eventName, callback)`.
 */
export type ViewEvents = {
  /** Emitted when the view is resized. Receives width and height in pixels. */
  resize: (w: number, h: number) => void;
  /** Emitted when a feature is picked. Receives picked feature info or null. */
  pick: (info: Nullable<PickedFeature>) => void;
  /** Emitted when a layer event occurs. Receives event type, layer ID, and event arguments. */
  layer: <K extends keyof LayerEvent>(
    k: K,
    layerId: string,
    ...args: Parameters<LayerEvent[K]>
  ) => void;
  /** Emitted before an update process happens. Receives `DOMHighResTimeStamp` as a timestamp. */
  preUpdate: (t: number) => void;
  /** Emitted after an update process when state changes occurred. Receives `DOMHighResTimeStamp` as a timestamp. */
  postUpdate: (t: number) => void;
  /** Emitted before rendering. With `animation: true`, fires every frame. Receives `DOMHighResTimeStamp` as a timestamp. */
  preRender: (t: number) => void;
  /** Emitted after rendering. With `animation: true`, fires every frame. Receives `DOMHighResTimeStamp` as a timestamp. */
  postRender: (t: number) => void;
  /** @private Emitted when terrain height sampling completes. */
  _sample_terrain_height_received: (ev: TerrainHeightUpdatedEvent) => void;
  /** @private Emitted when a material is mounted for CSM shadows. */
  _csmMounted: (material: Material) => void;
  /** @private Emitted when a material is unmounted from CSM shadows. */
  _csmUnmounted: (material: Material) => void;

  /** Emitted on mouse down with map coordinates. */
  mousedown: (event: MapMouseEvent) => void;
  /** Emitted when mouse enters the canvas with map coordinates. */
  mouseenter: (event: MapMouseEvent) => void;
  /** Emitted when mouse leaves the canvas with map coordinates. */
  mouseleave: (event: MapMouseEvent) => void;
  /** Emitted on mouse move with map coordinates. */
  mousemove: (event: MapMouseEvent) => void;
  /** Emitted on mouse up with map coordinates. */
  mouseup: (event: MapMouseEvent) => void;
  /** Emitted on click with map coordinates. */
  click: (event: MapMouseEvent) => void;
};

// Need an assignment to tell TypeScript compiler that this is being renamed...
type ActualLayerDescription = _ActualLayerDescription;

/**
 * The main 3D globe view class that manages rendering, layers, camera, and user interaction.
 * Create an instance and call `init()` to start the engine.
 *
 * @example
 * ```typescript
 * const view = new ThreeView();
 * await view.init();
 * ```
 */
export default class ThreeView<
  CustomLayerDescriptions extends
    | Record<string, unknown>
    | undefined = undefined,
  LayerDescription extends
    ActualLayerDescription = CustomLayerDescriptions extends undefined
    ? ActualLayerDescription
    : ActualLayerDescription | CustomLayerDescriptions,
> extends EventHandler<ViewEvents> {
  /** The camera controller that manages view position, orientation, and projection. */
  camera: ThreeViewCamera;
  /** The Three.js WebGL renderer instance used for rendering the scene. */
  renderer: WebGLRenderer;
  /** The globe instance that manages terrain, imagery layers, and globe-specific settings. */
  globe!: Globe;
  /** The atmosphere renderer that handles sky, sun, and atmospheric scattering effects. */
  atmosphere: Atmosphere;

  /** Layer handle for the sky environment map effect layer. Used for sky reflections. */
  skyEnvMapLayer?: LayerHandle<SkyEnvMapEffectLayer>;
  /** Layer handle for the Multi-Render Target pass that outputs color and normal buffers. */
  mrtPassLayer!: LayerHandle<MRTPassEffectLayer>;
  /** Layer handle for the transparent objects rendering pass. */
  transparentPassLayer!: LayerHandle<TransparentPassEffectLayer>;
  /** Layer handle for the final compositing pass that outputs to screen. */
  finalPassLayer!: LayerHandle<FinalCopyEffectLayer>;

  /** The render pass orchestrator that manages the post-processing effect pipeline. */
  renderPassOrchestrator: RenderPassOrchestrator;

  private _scenes: Scenes;
  // Store draped feature's materials
  private _drapedFeatureMaterials: DrapedMaterialCache = new Map();

  private _core: Core | undefined;
  private _options: Options;
  private _stats: RendererStats | undefined;
  private _eventDisposer: (() => void) | undefined;
  private _disposed = false;
  private _renderFlag: RenderFlag = {
    forceUpdate: false,
    animation: false,
  };
  private _uniforms: CommonUniforms;

  private _meshes: MeshCache = new Map();
  private _abortControllers: AbortControllers = new Map();
  private _workerPoolPromises: WorkerPoolPromises = new Map();
  private _loadedTexs = new Map<string, Texture>();
  private _texturizedSceneByTileCoordinates: TexturizedSceneByTileCoordinates;
  private _tileMapByHandle: TileMapByHandle = new Map();
  private _initialized = false;

  private _buf: BufferLoader = {
    u8: (handle) => {
      const b = this._core?.getBufferU8(handle);
      return b ?? null;
    },
    f32: (handle) => {
      const b = this._core?.getBufferF32(handle);
      return b ?? null;
    },
    f64: (handle) => {
      const b = this._core?.getBufferF64(handle);
      return b ?? null;
    },
    u32: (handle) => {
      const b = this._core?.getBufferU32(handle);
      return b ?? null;
    },
    removeU8: (handle) => {
      const b = this._core?.removeBufferU8(handle);
      return b ?? null;
    },
    removeU32: (handle) => {
      const b = this._core?.removeBufferU32(handle);
      return b ?? null;
    },
    removeF32: (handle) => {
      const b = this._core?.removeBufferF32(handle);
      return b ?? null;
    },
    removeF64: (handle) => {
      const b = this._core?.removeBufferF64(handle);
      return b ?? null;
    },
    setU8: (handle: number, bits: bigint, b: Uint8Array) => {
      if (!this._core?.hasDataRequester(bits)) {
        return;
      }
      this._core?.setBufferU8(handle, bits, b.length, (buf: Uint8Array) => {
        buf.set(b);
      });
    },
    newU8: (b: Uint8Array) => {
      return this._core?.newBufferU8(b.length, (buf: Uint8Array) => {
        buf.set(b);
      });
      // return this._core?.newBufferU8Cloned(b);
    },
    newU32: (b: Uint32Array) => {
      return this._core?.newBufferU32(b.length, (buf: Uint32Array) => {
        buf.set(b);
      });
      // return this._core?.newBufferU32Cloned(b);
    },
    newF32: (b: Float32Array) => {
      return this._core?.newBufferF32(b.length, (buf: Float32Array) => {
        buf.set(b);
      });
      // return this._core?.newBufferF32Cloned(b);
    },
    newF64: (b: Float64Array) => {
      return this._core?.newBufferF64(b.length, (buf: Float64Array) => {
        buf.set(b);
      });
      // return this._core?.newBufferF32Cloned(b);
    },
    remove: (handle: number) => {
      this._core?.removeBuffer(handle);
    },
    triggerDataRequesterFailed: (bits: bigint) => {
      this._core?.triggerDataRequesterFailed(bits);
    },
  };
  private _texFragment: TextureFragmentHandler = {
    triggerTextureFragmentLoaded: (
      bits: bigint,
      status: TextureFragmentStatus,
    ) => {
      this._core?.triggerTextureFragmentLoaded(bits, status);
    },
  };
  private _tileHandler: TileHandler = {
    getMartini: (id) => {
      return this._core?.getMartini(id);
    },
    getTile: (handle) => {
      return this._core?.getTile(handle);
    },
    getParentTile: (handle) => {
      return this._core?.getParentTile(handle);
    },
    getTileElevationDecoder: (handle) => {
      return this._core?.getTileElevationDecoder(handle);
    },
    getVectorTileStates: (handle) => {
      return this._core?.getVectorTileStates(handle);
    },
  };
  private _globeHandler: GlobeHandler = {
    getTransparent: () => {
      return this._core?.getGlobeTransparent();
    },
    getMaxSse: () => {
      return this._core?.getGlobeMaxSse();
    },
    getSegments: () => {
      return this._core?.getGlobeSegments();
    },
    getColor: (): CoreColor | undefined => {
      const hexColor = this._core?.getGlobeColor();
      return hexColor === undefined ? undefined : new Color().setHex(hexColor);
    },
    getHideUnderground: () => {
      return this._core?.getGlobeHideUnderground();
    },
    getShouldComputeNormalFromVertex: () => {
      return this._core?.getGlobeShouldComputeNormalFromVertex();
    },
    getOpacity: () => {
      return this._core?.getGlobeOpacity();
    },
    getWireframe: () => {
      return this._core?.getGlobeWireframe();
    },
    getElevationColormap: () => {
      return this._core?.getGlobeElevationColormap();
    },
    setTransparent: (value: boolean) => {
      this._core?.setGlobeTransparent(value);
    },
    setMaxSse: (value: number) => {
      this._core?.setGlobeMaxSse(value);
    },
    setSegments: (value: number) => {
      this._core?.setGlobeSegments(value);
    },
    setColor: (value: CoreColor) => {
      this._core?.setGlobeColor(value.toHex());
    },
    setHideUnderground: (value: boolean) => {
      this._core?.setGlobeHideUnderground(value);
    },
    setShouldComputeNormalFromVertex: (value: boolean) => {
      this._core?.setGlobeShouldComputeNormalFromVertex(value);
    },
    setOpacity: (value: number) => {
      this._core?.setGlobeOpacity(value);
    },
    setWireframe: (value: boolean) => {
      this._core?.setGlobeWireframe(value);
    },
    setElevationColormap: (value: ColorMap) => {
      this._core?.setGlobeElevationColormap(value.flatten());

      const canvas = value.createImage();
      const texture = new Texture(canvas);
      texture.wrapS = ClampToEdgeWrapping;
      texture.wrapT = ClampToEdgeWrapping;
      texture.minFilter = LinearFilter;
      texture.magFilter = LinearFilter;
      texture.generateMipmaps = false;
      texture.flipY = false;
      texture.needsUpdate = true;

      this._uniforms.colorMapTexture.value = texture;

      // Track additional texture usage
      this._defaultTextureOptions.additionalTexturesInUse = {
        ...this._defaultTextureOptions.additionalTexturesInUse,
        colorMapTexture: true,
      };
    },
  };
  private _workerTaskHandler: WorkerTaskHandler = {
    triggerWorkerTaskCompleted: (bits, result) => {
      this._core?.triggerWorkerTaskCompleted(bits, result);
    },
    hasWorkerTask: (bits) => {
      return !!this._core?.hasWorkerTask(bits);
    },
  };
  private _featureHandler: FeatureHandler = {
    getTransferablePolygonBatchedFeature: (bits) => {
      return this._core?.getTransferablePolygonBatchedFeature(bits);
    },
    getTransferablePolylineBatchedFeature: (bits) => {
      return this._core?.getTransferablePolylineBatchedFeature(bits);
    },
    markFeatureIsRendered: (type, bits) => {
      this._core?.markFeatureIsRendered(type, bits);
    },
    readPropertiesFromFeature: (featureId, f) =>
      this._core?.readPropertiesFromFeature(featureId, f),
  };
  private _meshHandler: MeshHandler = {
    setTileMeshPrepared: (handle: bigint) => {
      this._core?.setTileMeshPrepared(handle);
    },
  };
  private _eventManager = new EventManager();
  private _pickHelper?: PickHelper;
  private _terrainPicker: TerrainPicker;
  private _defaultTextureOptions: TextureOptions;
  private layersManager = new LayersManager();
  private shadowMapViewers: ShadowMapViewers;

  // Registry support
  private registries: Registries;
  /** Helper for managing selective post-processing effects that apply to specific objects. */
  public selectiveEffectHelper: SelectiveEffectHelper;
  private viewContext!: ViewContext;

  constructor(options: Options = {}) {
    super();

    if (!options.canvas) {
      const div = document.createElement("div");
      div.id = "navara-root";
      div.style.width = "100vw";
      div.style.height = "100vh";

      options.canvas = document.createElement("canvas");
      options.canvas.id = "navara-canvas";
      options.canvas.style.width = "100%";
      options.canvas.style.height = "100%";

      div.appendChild(options.canvas);

      document.body.appendChild(div);
    }

    this._options = options;

    // Initialize terrain picker
    this._terrainPicker = new TerrainPicker();

    // disable right-click
    options.canvas?.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });

    const renderer = new WebGLRenderer({
      // If it's true, some noise will happen. So use other AA algorithm instead.
      antialias: (options.multisampling ?? 0) > 0,
      logarithmicDepthBuffer: options.logarithmicDepthBuffer ?? true,
      canvas: options.canvas,
      stencil: true,
    });
    renderer.info.autoReset = false;
    renderer.autoClearStencil = false;
    renderer.autoClearColor = false;
    renderer.autoClearDepth = false;
    this.renderer = renderer;

    renderer.shadowMap.enabled = !!options.shadow;
    this.renderer.shadowMap.type = PCFSoftShadowMap;

    // Update shadow map manually in CustomRenderPass.
    renderer.shadowMap.autoUpdate = false;

    const { width, height } = this._getCanvasSize() ?? {};
    invariant(width && height);

    if (typeof options?.pixelRatio === "number" || !isWorker()) {
      const pixelRatio = isWorker()
        ? 1
        : getDevicePixelRatio({
            override: options.pixelRatio,
            mobileOptimization: options.mobileOptimization,
          });
      renderer.setPixelRatio(pixelRatio);
    }

    renderer.setSize(width, height, !isWorker());
    if (options.container) {
      options.container.appendChild(renderer.domElement);
    }

    this._texturizedSceneByTileCoordinates =
      new TexturizedSceneByTileCoordinates(this.renderer);

    this._scenes = {
      light: new Group(),
      mrt: new Scene(),
      globe: new Scene(),
      draped: new Scene(),
      opaque: new Scene(),
      transparent: new Scene(),
      skyEnvMap: new Scene(),
    };

    this.camera = new ThreeViewCamera();

    // Setup render pass orchestrator
    this.renderPassOrchestrator = new RenderPassOrchestrator(this.renderer, {
      halfFloat: options.halfFloat ?? true,
      multisampling: options.multisampling,
    });

    this.renderPassOrchestrator.setSize(width, height);

    // Background color
    const bgColor = options.backgroundColor
      ? options.backgroundColor.toHex()
      : 0x0a0a0f;
    this.renderer.setClearColor(bgColor);

    if (!options.disableAutoResize && !isWorker()) {
      window.addEventListener("resize", this._handleResize);
      // Observe a change in devicePixelRatio.
      window
        .matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
        .addEventListener("change", this._handleResize);
    }

    if (options.debug) {
      const t = options.container || this.renderer.domElement.parentElement;
      if (t) {
        this._stats = new RendererStats({
          beginRender: () => this.renderer.info.reset(),
          endRender: () => ({
            ...this.renderer.info.render,
            memGeometries: this.renderer.info.memory.geometries,
          }),
        });
        t.appendChild(this._stats.dom);
      }
    }

    this._uniforms = {
      viewportAndPixelRatio: { value: null },
      frustumNearFar: { value: null },
      frustumRatio: { value: null },
      tGlobeDepth: { value: null },
      tGlobeNormal: { value: null },
      tSkyEnvMap: { value: null },
      inverseProjectionMatrix: { value: null },
      // TODO: Need to sync `fov` with WASM side
      fov: { value: (this.camera.raw.fov * Math.PI) / 180 },
      screenHeightPx: { value: height },
      time: { value: 0 },
      colorMapTexture: { value: null },
      waterTexture: { value: null },
    };

    // This is necessary to avoid attaching a texture beyond the max textures capabilities of GPU.
    // TODO: Allow to change this value dynamically.
    const NUM_CASCADED_SHADOW_MAPS = 6;

    this._defaultTextureOptions = {
      maxAnisotropy: this.renderer.capabilities.getMaxAnisotropy(),
      magFilter: LinearFilter,
      minFilter: LinearFilter,
      useMipmaps: true,
      maxTextures:
        Math.max(this.renderer.capabilities.maxTextures, 8) -
        NUM_CASCADED_SHADOW_MAPS,
    };

    // Load shared water texture if enabled
    if (options.waterTexture?.enabled) {
      const waterUrl = options.waterTexture.url ?? WATER_NORMAL_URL;
      this._uniforms.waterTexture.value = TEXTURE_LOADER.load(
        waterUrl,
        (texture) => {
          texture.wrapS = RepeatWrapping;
          texture.wrapT = RepeatWrapping;
        },
      );
      // Track additional texture usage
      this._defaultTextureOptions.additionalTexturesInUse = {
        ...this._defaultTextureOptions.additionalTexturesInUse,
        waterTexture: true,
      };
    }

    this.atmosphere = new Atmosphere(this.renderer, options.atmosphere);
    this.atmosphere.on("_needsUpdate", this.forceUpdate);

    // Initialize SelectiveEffectHelper
    this.selectiveEffectHelper = new SelectiveEffectHelper(width, height);

    // Set up Registry
    this.viewContext = new ViewContext(
      this._scenes,
      this.camera.raw,
      this.atmosphere,
      this.layersManager,
      this.renderPassOrchestrator,
      createDefaultConcurrencyManager(),
      {
        meshes: this._meshes,
        drapedMaterials: this._drapedFeatureMaterials,
      },
      this,
      this.selectiveEffectHelper,
      {
        selectiveEffectMask: this._options.selectiveEffects?.debugViews,
      },
    );
    this.registries = new Registries(this.viewContext);

    this.on("layer", (e, id, ...args) => {
      this.layersManager.emitById(e, id, ...args);
    });

    // Register built-in layers
    this.registerBuiltIns();

    this._renderFlag.animation = !!options.animation;

    this.camera.on("frustumChanged", () => {
      this.renderPassOrchestrator.effectComposer.setMainCamera(this.camera.raw);
    });

    this.shadowMapViewers = new ShadowMapViewers(this._scenes.light);
  }

  /**
   * Convert a mouse event to a MapMouseEvent by adding map coordinates
   */
  private convertMouseEventToMapEvent(event: MouseEvent): MapMouseEvent | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const xyz = convertScreenPos(this, x, y);

    if (xyz) {
      return Object.assign(event, {
        map: {
          x: xyz.x,
          y: xyz.y,
          z: xyz.z,
        },
      }) as MapMouseEvent;
    }

    return null;
  }

  private async initializeRenderPass() {
    // Initialize atmosphere
    await this.atmosphere.init();

    this.skyEnvMapLayer = this.addLayer<SkyEnvMapEffectLayer>({
      type: "effect",
      skyEnvMap: {},
    } as LayerDescription);
    this.mrtPassLayer = this.addLayer<MRTPassEffectLayer>({
      type: "effect",
      mrt: {
        // debugNormal: true,
      },
    } as LayerDescription);
    this.transparentPassLayer = this.addLayer<TransparentPassEffectLayer>({
      type: "effect",
      transparent: {},
    } as LayerDescription);
    this.finalPassLayer = this.addLayer<FinalCopyEffectLayer>({
      type: "effect",
      final: {},
    } as LayerDescription);

    // Set up CSM material mounting listener
    this.on("_csmMounted", (material: Material) => {
      this.setupCSMForMaterial(material);
    });
    this.on("_csmUnmounted", (material: Material) => {
      this.removeCSMForMaterial(material);
    });
  }

  private get renderPass() {
    const instance = this.mrtPassLayer.ref.raw;
    invariant(instance);
    return instance;
  }

  /**
   * Gets the tone mapping exposure value.
   */
  get toneMappingExposure() {
    return this.renderer.toneMappingExposure;
  }
  /**
   * Sets the tone mapping exposure value for HDR rendering.
   */
  set toneMappingExposure(v: number) {
    this.renderer.toneMappingExposure = v;
    this.forceUpdate();
  }

  /**
   * Gets the globe depth texture for post-processing effects.
   */
  get globeDepthTexture() {
    return this.renderPass.globeDepthCopyPass.texture;
  }

  /**
   * Gets the globe normal texture for post-processing effects.
   */
  get globeNormalTexture() {
    return this.renderPass.globeNormalCopyPass.texture;
  }

  /**
   * Gets the scene normal texture from the G-buffer.
   */
  get normalTexture() {
    return this.renderPass.gbufferRenderTarget.textures[1];
  }

  /**
   * Forces an immediate re-render of the scene on the next frame.
   */
  forceUpdate = () => {
    this._renderFlag.forceUpdate = true;
  };

  /**
   * Initializes the 3D engine, WASM modules, and starts the main render loop.
   * Must be called before using the view.
   */
  async init() {
    if (this._core || this._initialized) return;

    this._initialized = true;

    const concurrencyManager = this.viewContext.concurrencyManager;

    initializeWorkerPool(WorkerURL, concurrencyManager);

    // Pre-warm all workers with WASM initialization
    const warmUpPromises: Promise<void>[] = [];
    for (let i = 0; i < concurrencyManager.total; i++) {
      warmUpPromises.push(warmUp());
    }

    await initCore();
    await initNavaraApi();

    this._core = new Core(newId());
    this._core.start();

    this.globe = new Globe(this._globeHandler, this._options);
    this.viewContext.setGlobe(this.globe);

    if (!isWorker()) {
      this._eventDisposer = registerInputEvents(
        this._core,
        this.renderer.domElement,
      );
      this._pickHelper = new PickHelper(
        this.renderer.domElement,
        this.renderer,
        this.camera.raw,
        this._scenes,
        this._meshes,
        this._drapedFeatureMaterials,
        this.onPick.bind(this),
        this.renderPassOrchestrator.effectComposer.inputBuffer,
        this.globe,
        // {
        //   debug: true,
        // },
      );
      this._pickHelper.enablePick(this._options.picking ?? true);
    }

    await this.initializeRenderPass();

    this._startMainLoop();

    const size = new Vector2();
    this.renderer.getSize(size);
    this.resize(size.width, size.height, this.renderer.getPixelRatio());

    this.camera.core = this._core;

    this.renderer.domElement.addEventListener("mousedown", (event) => {
      const mapEvent = this.convertMouseEventToMapEvent(event);
      if (mapEvent) {
        this.emit("mousedown", mapEvent);
      }
    });

    this.renderer.domElement.addEventListener("mouseenter", (event) => {
      const mapEvent = this.convertMouseEventToMapEvent(event);
      if (mapEvent) {
        this.emit("mouseenter", mapEvent);
      }
    });

    this.renderer.domElement.addEventListener("mouseleave", (event) => {
      const mapEvent = this.convertMouseEventToMapEvent(event);
      if (mapEvent) {
        this.emit("mouseleave", mapEvent);
      }
    });

    this.renderer.domElement.addEventListener("mousemove", (event) => {
      const mapEvent = this.convertMouseEventToMapEvent(event);
      if (mapEvent) {
        this.emit("mousemove", mapEvent);
      }
    });

    this.renderer.domElement.addEventListener("mouseup", (event) => {
      const mapEvent = this.convertMouseEventToMapEvent(event);
      if (mapEvent) {
        this.emit("mouseup", mapEvent);
      }
    });

    this.renderer.domElement.addEventListener("click", (event) => {
      const mapEvent = this.convertMouseEventToMapEvent(event);
      if (mapEvent) {
        this.emit("click", mapEvent);
      }
    });
  }

  /**
   * Disposes all resources and stops the render loop.
   * Call this when the view is no longer needed.
   */
  dispose() {
    this._disposed = true;
    if (!isWorker()) window.removeEventListener("resize", this._handleResize);
    if (this._eventDisposer) {
      this._eventDisposer();
      this._eventDisposer = undefined;
    }

    if (this._pickHelper) {
      this._pickHelper.dispose();
    }

    if (this._terrainPicker) {
      this._terrainPicker.dispose();
    }

    // Dispose SelectiveEffectHelper
    this.selectiveEffectHelper.dispose();

    this.renderer.setAnimationLoop(null);
    if (
      "dispose" in this.renderer &&
      typeof this.renderer.dispose === "function"
    ) {
      this.renderer.dispose();
    }
  }

  /**
   * Resizes the renderer and updates the camera aspect ratio.
   * @param width - New width in pixels (uses canvas size if omitted)
   * @param height - New height in pixels (uses canvas size if omitted)
   * @param pixelRatio - Device pixel ratio
   */
  resize = (width?: number, height?: number, pixelRatio?: number) => {
    if (this._disposed) return;

    const canvas = this._getCanvasSize();
    const w = typeof width === "number" ? width : canvas?.width;
    const h = typeof height === "number" ? height : canvas?.height;
    if (typeof w !== "number" || typeof h !== "number") return;

    this.camera.raw.aspect = w / h;
    this.camera.raw.updateProjectionMatrix();
    this.renderer.setSize(w, h, !isWorker());
    this.renderPassOrchestrator.setSize(w, h);
    if (this._options.pixelRatio == null && pixelRatio) {
      this.renderer.setPixelRatio(pixelRatio);
    }

    // Update SelectiveEffectHelper
    this.selectiveEffectHelper.setSize(w, h);

    this._core?.resize(w, h, pixelRatio ?? 1);

    this.emit("resize", w, h);
  };

  private _updateUniforms() {
    const viewport = this._getCanvasSize();
    const pixelRatio = this.renderer.getPixelRatio();

    // Ref: https://github.com/CesiumGS/cesium/blob/2cf09cb06e4f7ea767da39befabcfc3444b02c49/packages/engine/Source/Core/PerspectiveFrustum.js#L208-L218
    const fovY = this.camera.fovy ?? 1;
    const top = this.camera.raw.near * Math.tan(0.5 * fovY);
    const bottom = -top;
    const right = this.camera.raw.aspect * top;
    const left = -right;

    this._uniforms.viewportAndPixelRatio.value = [
      viewport?.width ?? 0,
      viewport?.height ?? 0,
      pixelRatio,
    ];
    this._uniforms.frustumNearFar.value = [
      this.camera.raw.near,
      this.camera.raw.far,
    ];
    this._uniforms.frustumRatio.value = [top, bottom, right, left];
    this._uniforms.tGlobeDepth.value =
      this.renderPass.globeDepthCopyPass.texture;
    this._uniforms.tGlobeNormal.value =
      this.renderPass.globeNormalCopyPass.texture;
    this._uniforms.tSkyEnvMap.value =
      this.skyEnvMapLayer?.ref.raw?.getEnvMapTexture() ?? null;
    this._uniforms.inverseProjectionMatrix.value =
      this.camera.raw.projectionMatrixInverse;

    // TODO: Need to sync `fov` with WASM side
    this._uniforms.fov.value = (this.camera.raw.fov * Math.PI) / 180;
    this._uniforms.screenHeightPx.value = viewport?.height ?? 0;
  }

  /** Returns true if the scene was updated and needs to be rendered. */
  private _update(updatedAt: number): boolean {
    this.emit("preUpdate", updatedAt);

    this._core?.update(updatedAt);

    const events = this._core?.readEvents();
    if ((!events && !this._eventManager.needsUpdate()) || !this._core) {
      return false;
    }

    processEvent(
      this._eventManager,
      this._scenes,
      this.camera,
      this._meshes,
      this._abortControllers,
      this._buf,
      this._texFragment,
      this._tileHandler,
      this._workerTaskHandler,
      this._meshHandler,
      this._featureHandler,
      this._loadedTexs,
      this._workerPoolPromises,
      events,
      this._uniforms,
      this._drapedFeatureMaterials,
      this._texturizedSceneByTileCoordinates,
      this._tileMapByHandle,
      this._defaultTextureOptions,
      this._renderFlag,
      this,
      this.layersManager,
      this.viewContext,
      updatedAt,
    );
    events?.free();

    this.camera.raw.updateMatrixWorld();

    this._updateUniforms();

    this.emit("postUpdate", updatedAt);

    return true;
  }

  /**
   * Process feature updates for all layers
   * This is called after the main update loop to batch feature updates
   */
  private _forceFeatureUpdates(updatedAt: number) {
    // Process updates for each layer
    for (const layer of this.layersManager.getResourceLayers()) {
      if (layer._processFeatureUpdates(updatedAt)) {
        this._renderFlag.forceUpdate = true;
      }
    }
  }

  private _render(updatedAt: number) {
    this._uniforms.time.value = updatedAt;

    this.atmosphere._update();

    this.emit("preRender", updatedAt);

    this.renderPassOrchestrator.render();
    if (this._options.selectiveEffects?.debugViews) {
      this.selectiveEffectHelper.renderDebugViews(
        this.renderPassOrchestrator.effectComposer.getRenderer(),
      );
    }
    this._pickHelper?.renderDebugCanvas();

    this.shadowMapViewers.render(this.renderer);

    this.emit("postRender", updatedAt);
  }

  /**
   * Since passing Color class to WASM is tricky, converts Navara Color
   * objects to numbers in layer descriptions.
   * Handles the two-level structure: layer -> material -> color fields.
   */
  private _convertColorsToNumbers(obj: unknown): unknown {
    if (obj === null || obj === undefined || typeof obj !== "object") {
      return obj;
    }

    // Process the object's properties (shallow copy)
    const result: Record<string, unknown> = { ...obj };

    for (const [key, value] of Object.entries(result)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        // Nested object (e.g., point, billboard, text, model, etc.)
        const nestedResult: Record<string, unknown> = { ...value };
        for (const [nestedKey, nestedValue] of Object.entries(nestedResult)) {
          if (nestedValue instanceof Color) {
            nestedResult[nestedKey] = nestedValue.toHex();
          }
        }
        result[key] = nestedResult;
      }
    }

    return result;
  }

  /**
   * Adds a new layer to the scene.
   * @param l - Layer configuration object specifying type and options
   * @returns A Layer or LayerHandle for controlling the added layer
   */
  addLayer<L = unknown>(
    l: LayerDescription,
  ): L extends LayerDeclaration ? LayerHandle<L> : Layer {
    // Check if this is a mesh layer
    if (l.type === "mesh") {
      return this.addMeshLayer(
        l as MeshLayerDeclarationDescription,
      ) as L extends LayerDeclaration ? LayerHandle<L> : never; // TODO: Remove this cast later.
    }

    // Check if this is a light layer
    if (l.type === "light") {
      return this.addLightLayer(
        l as LightLayerDeclarationDescription,
      ) as L extends LayerDeclaration ? LayerHandle<L> : never; // TODO: Remove this cast later.
    }

    // Check if this is an effect layer
    if (l.type === "effect") {
      return this.addEffectLayer(
        l as EffectLayerDeclarationDescription,
      ) as L extends LayerDeclaration ? LayerHandle<L> : never; // TODO: Remove this cast later.
    }

    // Convert all Color objects to numbers before passing to Rust
    const processedLayer = this._convertColorsToNumbers(l) as LayerDescription;

    // Existing resource layer process
    const layerId = this._core?.addLayer(processedLayer);
    invariant(layerId);
    invariant(this._core);

    const layer = new Layer(
      layerId,
      this._core,
      this._convertColorsToNumbers.bind(this),
    );
    this.layersManager.add(layer);

    return layer as L extends LayerDeclaration ? never : Layer; // TODO: Remove this cast later.
  }

  /**
   * Updates an existing layer's configuration by its ID.
   * @param layerId - The unique identifier of the layer to update
   * @param l - New layer configuration
   */
  updateLayerById(layerId: string, l: LayerDescription) {
    invariant(this._core);
    // Convert all Color objects to numbers before updating
    const processedLayer = this._convertColorsToNumbers(l) as LayerDescription;
    this.layersManager.get(layerId)?.update(processedLayer);
  }

  /**
   * Deletes a layer from the scene by its ID.
   * @param layerId - The unique identifier of the layer to delete
   */
  deleteLayerById(layerId: string) {
    invariant(this._core);

    this.layersManager.get(layerId)?.delete();
  }

  private registerBuiltIns(): void {
    this.registerBuiltInMeshes();
    this.registerBuiltInLights();
    this.registerBuiltInEffects();
  }

  private registerBuiltInMeshes(): void {
    this.registerMesh("rain", RainMeshLayer);
    this.registerMesh("snow", SnowMeshLayer);
    this.registerMesh("sky", SkyMeshLayer);
    this.registerMesh("skyBox", SkyBoxMeshLayer);
    this.registerMesh("stars", StarsLayer);
    this.registerMesh("box", BoxMeshLayer);
    this.registerMesh("sphere", SphereMeshLayer);
    this.registerMesh("glowGlobe", GlowGlobeMeshLayer);
    this.registerMesh("cylinder", CylinderMeshLayer);
    this.registerMesh("tube", TubeMeshLayer);
    this.registerMesh("plane", PlaneMeshLayer);
    this.registerMesh("gltfModel", GLTFModelLayer);
    this.registerMesh("axesHelper", AxesHelperLayer);
    this.registerMesh("arrowHelper", ArrowHelperLayer);
    this.registerMesh("arcLines", ArclineMeshLayer);
    this.registerMesh("smoothLines", SmoothLineMeshLayer);
  }

  private registerBuiltInLights(): void {
    this.registerLight("sun", SunLightLayer);
    this.registerLight("ambient", AmbientLightLayer);
    this.registerLight("skyLightProbe", SkyLightProbeLayer);
    this.registerLight("lightProbe", LightProbeLayer);
  }

  private registerBuiltInEffects(): void {
    this.registerEffect("skyEnvMap", SkyEnvMapEffectLayer);
    this.registerEffect("mrt", MRTPassEffectLayer);

    this.registerEffect("aerialPerspective", AerialPerspectiveEffectLayer);
    this.registerEffect("rainDrop", RainDropEffectLayer);
    this.registerEffect("clouds", CloudsEffectLayer);
    this.registerEffect("fogLight", FogLightEffectLayer);
    this.registerEffect("lensFlare", LensFlareEffectLayer);
    this.registerEffect("ssao", SSAOEffectLayer);
    this.registerEffect("ssr", SSREffectLayer);
    this.registerEffect("depthOfField", DepthOfFieldEffectLayer);
    this.registerEffect("colorGradingLUT", ColorGradingLUTEffectLayer);

    // SelectiveEffect effects
    this.registerEffect("testSelectiveEffect", TestSelectiveEffectLayer);
    this.registerEffect("selectiveBloom", SelectiveBloomEffectLayer);
    this.registerEffect("selectiveOutline", SelectiveOutlineEffectLayer);
    // TODO: Curve out opaque pass from MRT pass.
    // this.registerEffect("opaque", OpaquePassEffectLayer);
    this.registerEffect("transparent", TransparentPassEffectLayer);

    this.registerEffect("toneMapping", ToneMappingEffectLayer);
    this.registerEffect("smaa", SMAAEffectLayer);
    this.registerEffect("fxaa", FXAAEffectLayer);
    this.registerEffect("final", FinalCopyEffectLayer);
  }

  private addMeshLayer(config: MeshLayerDeclarationDescription): LayerHandle {
    // Find which mesh type from config
    const meshType = this.registries.mesh.findMeshType(config);
    if (!meshType) {
      throw new Error("No mesh type specified in configuration");
    }

    // Extract layer config and mesh-specific config
    const { type, ...meshConfigs } = config;
    const flatConfig = { ...config, ...meshConfigs };
    // Create mesh layer instance
    const meshLayer = this.registries.mesh.create(meshType, flatConfig);

    // Initialize the mesh
    meshLayer.onCreate();

    // Set up update listener
    if (meshLayer.update) {
      this.on("preRender", meshLayer.update.bind(meshLayer));
    }

    if (meshLayer.onResize) {
      this.on("resize", meshLayer.onResize.bind(meshLayer));

      const canvasSize = this._getCanvasSize();
      if (canvasSize) {
        meshLayer.onResize(canvasSize.width, canvasSize.height);
      }
    }

    // Trigger re-render
    meshLayer.on("_needsUpdate", this.forceUpdate);

    const l = new LayerHandle(meshLayer);

    // Store the mesh layer
    this.layersManager.add(l);

    // Return handle for imperative access
    return l;
  }

  private addLightLayer(config: LightLayerDeclarationDescription): LayerHandle {
    // Find which light type from config
    const lightType = this.registries.light.findLightType(config);
    if (!lightType) {
      throw new Error("No light type specified in configuration");
    }

    // Extract layer config and light-specific config
    const { type, ...lightConfigs } = config;
    const flatConfig = { ...config, ...lightConfigs };

    // Create light layer instance
    const lightLayer = this.registries.light.create(lightType, flatConfig);

    // Initialize the light
    lightLayer.onCreate();

    // Set up update listener if the layer has an update method
    if (lightLayer.update) {
      this.on("preRender", lightLayer.update.bind(lightLayer));
    }

    // Trigger re-render
    lightLayer.on("_needsUpdate", this.forceUpdate);

    const l = new LayerHandle(lightLayer);

    // Store the light layer
    this.layersManager.add(l);

    // Return handle for imperative access
    return l;
  }

  private addEffectLayer(
    config: EffectLayerDeclarationDescription,
  ): LayerHandle {
    // Find which effect type from config
    const effectType = this.registries.effect.findEffectType(config);
    if (!effectType) {
      throw new Error("No effect type specified in configuration");
    }

    // Extract layer config and effect-specific config
    const { type, ...effectConfigs } = config;
    const flatConfig = { ...config, ...effectConfigs };

    // Create effect layer instance
    const effectLayer = this.registries.effect.create(effectType, flatConfig);

    // Initialize the effect
    effectLayer.onCreate();

    // Set up update listener if the layer has an update method
    if (effectLayer.update) {
      this.on("preRender", effectLayer.update.bind(effectLayer));
    }

    // Trigger re-render
    effectLayer.on("_needsUpdate", this.forceUpdate);

    const l = new LayerHandle(effectLayer);

    // Store the effect layer
    this.layersManager.add(l);

    // Return handle for imperative access
    return l;
  }

  /**
   * Registers a custom mesh layer type for use with addLayer().
   * @param name - Unique name to identify this mesh type in layer configurations
   * @param meshClass - The mesh layer class constructor
   */
  registerMesh(name: string, meshClass: MeshLayerConstructor): void {
    this.registries.mesh.register(name, meshClass);
  }

  /**
   * Registers a custom light layer type for use with addLayer().
   * @param name - Unique name to identify this light type in layer configurations
   * @param lightClass - The light layer class constructor
   */
  registerLight(name: string, lightClass: LightLayerConstructor): void {
    this.registries.light.register(name, lightClass);
  }

  /**
   * Registers a custom post-processing effect layer type for use with addLayer().
   * @param name - Unique name to identify this effect type in layer configurations
   * @param effectClass - The effect layer class constructor
   */
  registerEffect(name: string, effectClass: EffectLayerConstructor): void {
    this.registries.effect.register(name, effectClass);
  }

  /**
   * Find the sun light layer in the current layers
   */
  private findSunLightLayer(): SunLightLayer | null {
    // Look through registered layers for sun light layer
    for (const layer of this.layersManager.getDeclarationLayers()) {
      const layerInstance = layer.ref;
      // Check if it's a SunLightLayer
      if (layerInstance instanceof SunLightLayer) {
        return layerInstance;
      }
    }
    return null;
  }

  /**
   * Setup CSM for a single material
   */
  private setupCSMForMaterial(material: Material): void {
    const sunLightLayer = this.findSunLightLayer();
    if (!sunLightLayer) {
      return;
    }
    sunLightLayer._setupMaterialForShadows(material);
  }

  /**
   * Remove CSM for a single material
   */
  private removeCSMForMaterial(material: Material): void {
    const sunLightLayer = this.findSunLightLayer();
    if (!sunLightLayer) {
      return;
    }
    sunLightLayer._removeMaterialFromShadows(material);
  }

  /**
   * Adds the default atmosphere layers including sky, stars, and sun lighting.
   * @returns Handles to the created sky, skyEnv, stars, skyLightProbe, and sun layers
   */
  // TODO: Handle this in plugin system.
  addDefaultAtmosphereLayers() {
    return {
      sky: this.addLayer<SkyMeshLayer>({
        type: "mesh",
        sky: {},
      } as LayerDescription),
      skyEnv: this.addLayer<SkyMeshLayer>({
        type: "mesh",
        sky: {
          envMap: true,
          sunAngularRadius: 0.1,
        },
      } as LayerDescription),
      stars: this.addLayer<StarsLayer>({
        type: "mesh",
        stars: {},
      } as LayerDescription),
      skyLightProbe: this.addLayer<SkyLightProbeLayer>({
        type: "light",
        skyLightProbe: {},
      } as LayerDescription),
      sun: this.addLayer<SunLightLayer>({
        type: "light",
        sun: {},
      } as LayerDescription),
    };
  }

  /**
   * Adds default post-processing effect layers including aerial perspective, tone mapping, and anti-aliasing.
   * On mobile devices (when mobileOptimization is enabled), uses lighter-weight effects.
   * @returns Handles to the created aerialPerspective, lensFlare, toneMapping, and antialiasing layers
   */
  addDefaultEffectLayers(): {
    aerialPerspective: LayerHandle<AerialPerspectiveEffectLayer>;
    lensFlare: LayerHandle<LensFlareEffectLayer> | undefined;
    toneMapping: LayerHandle<ToneMappingEffectLayer>;
    antialiasing: LayerHandle<SMAAEffectLayer> | LayerHandle<FXAAEffectLayer>;
  } {
    const mobile = this._options?.mobileOptimization ? isMobileDevice() : false;

    const aerialPerspective = this.addLayer<AerialPerspectiveEffectLayer>({
      type: "effect",
      aerialPerspective: {},
    } as LayerDescription);

    // Skip lens flare on mobile - expensive effect with limited benefit
    const lensFlare = mobile
      ? undefined
      : this.addLayer<LensFlareEffectLayer>({
          type: "effect",
          lensFlare: {},
        } as LayerDescription);

    const toneMapping = this.addLayer<ToneMappingEffectLayer>({
      type: "effect",
      toneMapping: {},
    } as LayerDescription);

    // Use FXAA on mobile (faster), SMAA on desktop (higher quality)
    const antialiasing = mobile
      ? this.addLayer<FXAAEffectLayer>({
          type: "effect",
          fxaa: {},
        } as LayerDescription)
      : this.addLayer<SMAAEffectLayer>({
          type: "effect",
          smaa: {},
        } as LayerDescription);

    return {
      aerialPerspective,
      lensFlare,
      toneMapping,
      antialiasing,
    };
  }

  /**
   * Returns the current order of effect passes for debugging purposes.
   * @returns Array of effect pass names in execution order
   */
  getEffectOrder(): string[] {
    return this.renderPassOrchestrator.getPassNames();
  }

  /**
   * Sets the camera position and orientation instantly.
   * @param camPos - Camera position with lng (degrees), lat (degrees), height (meters), and optional pitch, heading, roll (degrees)
   */
  setCamera(camPos: CameraPosition) {
    function checkFinite(value: number | undefined): value is number {
      return Number.isFinite(value) && value != null;
    }

    const position =
      checkFinite(camPos.lng) &&
      checkFinite(camPos.lat) &&
      checkFinite(camPos.height)
        ? new Float64Array([camPos.lng, camPos.lat, camPos.height])
        : null;

    this._core?.changeCamera(
      position,
      camPos.pitch,
      camPos.heading,
      camPos.roll,
    );
  }

  /**
   * Moves the camera in a specified direction.
   * @param move - Direction: `CameraDirection`
   * @param amount - Distance to move in meters
   */
  moveCamera(move: CameraDirection, amount: number) {
    switch (move) {
      case CameraDirection.Forward:
        this._core?.moveCamera(CameraDirection.Forward, amount);
        break;
      case CameraDirection.Backward:
        this._core?.moveCamera(CameraDirection.Backward, amount);
        break;
      case CameraDirection.Up:
        this._core?.moveCamera(CameraDirection.Up, amount);
        break;
      case CameraDirection.Down:
        this._core?.moveCamera(CameraDirection.Down, amount);
        break;
      case CameraDirection.Left:
        this._core?.moveCamera(CameraDirection.Left, amount);
        break;
      case CameraDirection.Right:
        this._core?.moveCamera(CameraDirection.Right, amount);
        break;
      default:
        break;
    }
  }

  /**
   * Moves the camera along a custom direction vector.
   * @param dir - Direction vector as [x, y, z] array
   * @param amount - Distance to move in meters
   */
  moveCameraWithDirection(dir: number[], amount: number) {
    if (dir.length !== 3) {
      return;
    }

    this._core?.moveCameraWithDirection(new Float64Array(dir), amount);
  }

  /**
   * Animates the camera to fly to a target position.
   * @param camPos - Target position with required lng (degrees), lat (degrees), height (meters), and optional pitch, heading, roll (degrees)
   * @param duration - Animation duration in milliseconds
   * @param maxHeight - Maximum height during the flight arc in meters
   */
  flyTo(
    camPos: CameraPosition &
      Required<Pick<CameraPosition, "lng" | "lat" | "height">>,
    duration?: number,
    maxHeight?: number,
  ) {
    const position = new Float64Array([camPos.lng, camPos.lat, camPos.height]);

    this._core?.flyTo(
      position,
      camPos.pitch,
      camPos.heading,
      camPos.roll,
      duration,
      maxHeight,
    );
  }

  /**
   * Makes the camera look at a target position with an offset.
   * @param target - Target geodetic position (lng in degrees, lat in degrees, height in meters)
   * @param offset - Offset from the target in East-North-Up (ENU) coordinates (meters)
   */
  lookAt(target: LatLngHeight, offset: Vector3) {
    this._core?.lookAt(
      new Float64Array([target.lng, target.lat, target.height]),
      new Float64Array([offset.x, offset.y, offset.z]),
    );
  }

  /**
   * Enables or disables camera following mode.
   * @param enabled - Whether to enable camera following
   * @param target - Target geodetic position to follow (lng in degrees, lat in degrees, height in meters)
   * @param offset - Offset from the target in East-North-Up (ENU) coordinates (meters)
   */
  cameraFollow(enabled: boolean, target?: LatLngHeight, offset?: Vector3) {
    const targetArray = target
      ? new Float64Array([target.lng, target.lat, target.height])
      : undefined;
    const offsetArray = offset
      ? new Float64Array([offset.x, offset.y, offset.z])
      : undefined;

    this._core?.cameraFollow(enabled, targetArray, offsetArray);
  }

  /**
   * Samples the terrain height at a given geodetic position synchronously.
   * @param pos - Geodetic position (lat in radians, lng in radians; height is ignored)
   * @returns Terrain height in meters, or undefined if terrain data not loaded
   */
  sampleTerrainHeight(pos: LatLngHeight): number | undefined {
    const lle = new LLE(pos.lat, pos.lng, 0);
    return this._core?.sampleTerrainHeight(lle);
  }

  /**
   * Observes terrain height changes at a position. Callback is invoked each time terrain data updates.
   * @param pos - Geodetic position to observe (lat in radians, lng in radians)
   * @param cb - Callback function receiving the terrain height in meters
   * @returns Cleanup function to stop observing
   */
  observeTerrainHeightAt(
    pos: LatLng,
    cb: (height: number) => void,
  ): () => void {
    if (!this._core) {
      return () => {};
    }

    const lle = new LLE(pos.lat, pos.lng, 0);
    const entityBits = this._core.registerSampleTerrainHeightEvent(lle);

    const callFunc = (ev: TerrainHeightUpdatedEvent) => {
      if (ev.bits === entityBits && ev.height) {
        cb(ev.height);
      }
    };

    this.on("_sample_terrain_height_received", callFunc);

    return () => {
      this._core?.unregisterSampleTerrainHeightEvent(entityBits);
      this.off("_sample_terrain_height_received", callFunc);
    };
  }

  /**
   * Rotates the camera around an axis.
   * @param axis - Axis to rotate around (zero vector uses default)
   * @param angle - Rotation angle in radians
   */
  rotateAroundAxis(axis: Vector3, angle: number) {
    this._core?.rotateAroundAxis(
      new Float64Array([axis.x, axis.y, axis.z]),
      angle,
    );
  }

  /**
   * Rotates the camera around the current look-at point or center of view.
   * @param angle - Rotation angle in radians
   */
  rotateAround(angle: number) {
    this._core?.rotateAroundAxis(null, angle);
  }

  private _startMainLoop() {
    const loop: XRFrameRequestCallback = (time) => {
      if (this._disposed) return;
      this._stats?.begin();

      this._forceFeatureUpdates(time);

      if (
        this._update(time) ||
        this._renderFlag.forceUpdate ||
        this._renderFlag.animation
      )
        this._render(time);
      this._renderFlag.forceUpdate = false;

      this._stats?.end();
    };
    this.renderer.setAnimationLoop(loop);
  }

  private _getCanvasSize(): { width: number; height: number } | undefined {
    const element =
      this._options.container ??
      this.renderer.domElement?.parentElement ??
      this.renderer.domElement;
    if (!element) return;

    const width = element.offsetWidth;
    const height = element.offsetHeight;
    if (typeof width !== "number" && typeof height !== "number") {
      return;
    }

    return { width, height };
  }

  private _handleResize = () => {
    const { width, height } = this._getCanvasSize() ?? {};
    if (!width || !height) return;

    const pixelRatio = isWorker()
      ? (this._options.pixelRatio ?? 1)
      : window.devicePixelRatio;
    this.resize(width, height, pixelRatio);
  };

  /**
   * Handles pick events and emits the picked feature information.
   * @param pickArr - Array of picked batch IDs
   */
  onPick(pickArr: number[]) {
    this._renderFlag.forceUpdate = true;

    if (pickArr.length > 0) {
      const prop = this._core?.getBatchProp(pickArr[0]);
      if (prop) {
        const pickedFeature: PickedFeature = {
          properties: prop.properties,
          batchId: pickArr[0],
          layerId: prop.layerId,
        };
        this.emit("pick", pickedFeature);
      } else {
        const emptyFeature: PickedFeature = {
          properties: new Map<string, unknown>(),
          batchId: null,
          layerId: null,
        };
        this.emit("pick", emptyFeature);
      }
    } else {
      this.emit("pick", null);
    }
  }

  /**
   * Gets whether continuous animation mode is enabled.
   */
  get animation() {
    return this._renderFlag.animation;
  }
  /**
   * Sets whether to render every frame continuously (true) or only on changes (false).
   */
  set animation(v: boolean) {
    this._renderFlag.animation = v;
  }

  /**
   * Gets the current screen size in pixels.
   */
  get screenSize() {
    const size = new Vector2();
    this.renderer.getSize(size);
    return size;
  }

  /**
   * Gets the current device pixel ratio.
   */
  get pixelRatio() {
    return this.renderer.getPixelRatio();
  }

  /**
   * Gets whether shadow map debug viewers are displayed.
   */
  get shadowMapViewersEnabled() {
    return this.shadowMapViewers.enabled;
  }
  /**
   * Enables or disables shadow map debug viewers on screen.
   */
  set shadowMapViewersEnabled(v: boolean) {
    this.shadowMapViewers.enabled = v;
  }

  /**
   * Enables or disables debug views for selective post-processing effects.
   * When disabled, disposes all debug view canvas elements.
   * @param enabled - Whether to enable debug views
   */
  setSelectiveEffectDebugViews(enabled: boolean): void {
    this._options.selectiveEffects ??= {};
    this._options.selectiveEffects.debugViews = enabled;
    this.selectiveEffectHelper.setDebugViewsAll(enabled);
  }

  /**
   * Picks the terrain position at screen coordinates.
   * @param x - Screen X coordinate in CSS pixels (same as MouseEvent.clientX)
   * @param y - Screen Y coordinate in CSS pixels (same as MouseEvent.clientY)
   * @returns World position Vector3 in ECEF coordinates, or null if no terrain is hit
   */
  pickTerrainPosition(x: number, y: number): Nullable<Vector3> {
    return this._terrainPicker.pick(
      x,
      y,
      this.renderer,
      this.globeDepthTexture,
      this.camera.raw,
    );
  }
}

function newId() {
  return Math.random().toString(36).slice(2);
}
