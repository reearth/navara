import { EventManager, EventHandler, Globe, Plugin } from "@navara/core";
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
import { FontManager, type FontFamily } from "@navara/font";
import FontWorkerURL from "@navara/font/fontWorker?worker&url";
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
  PCFShadowMap,
} from "three";
import invariant from "tiny-invariant";

import { Atmosphere, type AtmosphereOptions } from "./atmosphere";
import { ThreeViewCamera } from "./camera";
import { Color } from "./Color";
import { createDefaultConcurrencyManager } from "./concurrency";
import { WATER_NORMAL_URL } from "./constants/assets";
import {
  MeshDesc,
  LightDesc,
  EffectDesc,
  ViewContext,
  type MeshConfig,
  type LightConfig,
  type EffectConfig,
  type MeshLayerConstructor,
  type LightLayerConstructor,
  type EffectLayerConstructor,
  UnknownTypeError,
} from "./core";
import { MeshHandle, LightHandle, EffectHandle } from "./core/BaseHandle";
import { Registries } from "./core/Registries";
import { getDevicePixelRatio, isMobileDevice } from "./device";
import {
  processEvent,
  EventContext,
  type BufferLoader,
  type FeatureHandler,
  type GlobeHandler,
  type LayerHandler,
  type MeshHandler,
  type TextureFragmentHandler,
  type TileHandler,
  type WorkerTaskHandler,
} from "./event";
import { TEXTURE_LOADER } from "./event/loaders";
import { registerInputEvents } from "./input";
import { Layer, type LayerEvent } from "./layer";
import {
  MRTPassEffectDesc,
  SelectiveBloomEffectDesc,
  SelectiveOutlineEffectDesc,
  SkyEnvMapEffectDesc,
  TransparentPassEffectDesc,
} from "./layers/effect";
import { FinalCopyEffectDesc } from "./layers/effect/FinalCopyEffectDesc";
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
  type LayerDescription,
  type BuiltInEffectDescription,
  type Declarations,
  type EmptyDeclarations,
  type OmitType,
  type MeshCache,
  type PickedFeature,
  type WorkerPoolPromises,
  type RenderFlag,
  type TileMapByHandle,
} from "./type";
import type { CommonUniforms } from "./uniforms";
import { isWorker, convertScreenPos } from "./utils";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
/** @ts-ignore ignore: https://v3.vitejs.dev/guide/features.html#import-with-query-suffixes  */
import WorkerURL from "./worker?url&worker";

export type { CameraOptions, CameraEvent } from "./camera";

export { ColorMap, EventHandler, Plugin } from "@navara/core";
export type {
  Nullable,
  XYZ,
  LatLng,
  LatLngHeight,
  CameraOrientation,
  CameraPosition,
  ColorTuple,
  LUT,
  Globe,
  Observed,
  ObservedEvent,
} from "@navara/core";
export { CameraDirection } from "@navara/engine";
// CSM exports for advanced users
export { CascadedShadowMaps, CSMHelper } from "@navara/three_csm";

export * from "./type";
export * from "./constants";
export * from "./light";
export * from "./mesh";
export * from "./layer";
export * from "./effects";
export * from "./shaders";
export * from "./material";
export * from "./core";
export { BufferView } from "./bufferView";
export * from "./layers";
export * from "./passes";
export * from "./evaluations";
export { SKY_RENDER_ORDER, STARS_RENDER_ORDER } from "./renderOrder";
export * from "@navara/three_api";
export * from "./Color";
export { type BlendMode, blendFunction, createReplacer } from "./utils";
export { Atmosphere, type AtmosphereOptions } from "./atmosphere";
export type { Quality } from "./quality";
export type { CustomObject3DEventMap } from "./object3DEvent";
export type { FontFamily, FontFace } from "@navara/font";

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
  D extends Declarations = EmptyDeclarations,
> extends EventHandler<ViewEvents> {
  private _camera: ThreeViewCamera;
  private _renderer: WebGLRenderer;
  private _globe!: Globe;
  private _atmosphere: Atmosphere;

  /** Handle for the sky environment map effect layer. Used for sky reflections. */
  private skyEnvMapLayer!: EffectHandle<SkyEnvMapEffectDesc>;
  /** Handle for the Multi-Render Target pass that outputs color and normal buffers. */
  private mrtPassLayer!: EffectHandle<MRTPassEffectDesc>;
  /** Handle for the transparent objects rendering pass. */
  private transparentPassLayer!: EffectHandle<TransparentPassEffectDesc>;
  /** Handle for the final compositing pass that outputs to screen. */
  private finalPassLayer!: EffectHandle<FinalCopyEffectDesc>;

  /** The render pass orchestrator that manages the post-processing effect pipeline. */
  private renderPassOrchestrator: RenderPassOrchestrator;

  private _scenes: Scenes;

  private _core: Core | undefined;
  private _fontManager = new FontManager(FontWorkerURL);
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
    readAllBatchedProperties: (featureId, f) =>
      this._core?.readAllBatchedProperties(featureId, f),
    readFilteredBatchedProperties: (featureId, keys, f) =>
      this._core?.readFilteredBatchedProperties(featureId, keys, f),
  };
  private _meshHandler: MeshHandler = {
    setTileMeshPrepared: (handle: bigint) => {
      this._core?.setTileMeshPrepared(handle);
    },
  };
  private _layerHandler: LayerHandler = {
    getLayerIndex: (layerId: string) => {
      return this._core?.getLayerIndex(layerId);
    },
  };
  private _eventManager = new EventManager();
  private _pickHelper?: PickHelper;
  private _terrainPicker: TerrainPicker;
  private _defaultTextureOptions: TextureOptions;
  private layersManager = new LayersManager();
  private shadowMapViewers: ShadowMapViewers;
  private eventContext!: EventContext;

  // Registry support
  private registries!: Registries;
  private viewContext!: ViewContext;
  private plugins: Plugin[] = [];

  private pixelRatioMatchedMedia?: MediaQueryList;

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
    this._renderer = renderer;

    renderer.shadowMap.enabled = !!options.shadow;
    this._renderer.shadowMap.type = PCFShadowMap;

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
      new TexturizedSceneByTileCoordinates(this._renderer);

    this._scenes = {
      light: new Group(),
      mrt: new Scene(),
      globe: new Scene(),
      draped: new Scene(),
      opaque: new Scene(),
      transparent: new Scene(),
      skyEnvMap: new Scene(),
    };

    this._camera = new ThreeViewCamera();

    // Setup render pass orchestrator
    this.renderPassOrchestrator = new RenderPassOrchestrator(this._renderer, {
      halfFloat: options.halfFloat ?? true,
      multisampling: options.multisampling,
    });

    this.renderPassOrchestrator.setSize(width, height);

    // Background color
    const bgColor = options.backgroundColor
      ? options.backgroundColor.toHex()
      : 0x0a0a0f;
    this._renderer.setClearColor(bgColor);

    if (!options.disableAutoResize && !isWorker()) {
      window.addEventListener("resize", this._handleResize);
      // Observe a change in devicePixelRatio.
      this.pixelRatioMatchedMedia = window.matchMedia(
        `(resolution: ${window.devicePixelRatio}dppx)`,
      );

      this.pixelRatioMatchedMedia.addEventListener(
        "change",
        this._handleResize,
      );
    }

    if (options.debug) {
      const t = options.container || this._renderer.domElement.parentElement;
      if (t) {
        this._stats = new RendererStats({
          beginRender: () => this._renderer.info.reset(),
          endRender: () => ({
            ...this._renderer.info.render,
            memGeometries: this._renderer.info.memory.geometries,
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
      fov: { value: (this._camera.raw.fov * Math.PI) / 180 },
      screenHeightPx: { value: height },
      time: { value: 0 },
      colorMapTexture: { value: null },
      waterTexture: { value: null },
    };

    // This is necessary to avoid attaching a texture beyond the max textures capabilities of GPU.
    // TODO: Allow to change this value dynamically.
    const NUM_CASCADED_SHADOW_MAPS = 6;

    this._defaultTextureOptions = {
      maxAnisotropy: this._renderer.capabilities.getMaxAnisotropy(),
      magFilter: LinearFilter,
      minFilter: LinearFilter,
      useMipmaps: true,
      maxTextures:
        Math.max(this._renderer.capabilities.maxTextures, 8) -
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

    this._atmosphere = new Atmosphere(this._renderer, options.atmosphere);
    this._atmosphere.on("needsUpdate", this.forceUpdate);

    this.on("layer", (e, id, ...args) => {
      this.layersManager.emitById(e, id, ...args);
    });

    this._renderFlag.animation = !!options.animation;

    this._camera.on("frustumChanged", () => {
      this.renderPassOrchestrator.effectComposer.setMainCamera(
        this._camera.raw,
      );
    });

    this.shadowMapViewers = new ShadowMapViewers(this._scenes.light);
  }

  /**
   * Convert a mouse event to a MapMouseEvent by adding map coordinates
   */
  private convertMouseEventToMapEvent(event: MouseEvent): MapMouseEvent | null {
    const rect = this._renderer.domElement.getBoundingClientRect();
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
    await this._atmosphere._init();

    this.skyEnvMapLayer = this.addEffect<SkyEnvMapEffectDesc>({
      skyEnvMap: {},
    });
    this.mrtPassLayer = this.addEffect<MRTPassEffectDesc>({
      mrt: {
        // debugNormal: true,
      },
    });
    this.transparentPassLayer = this.addEffect<TransparentPassEffectDesc>({
      transparent: {},
    });
    this.finalPassLayer = this.addEffect<FinalCopyEffectDesc>({
      final: {},
    });
  }

  private get renderPass() {
    const instance = this.mrtPassLayer.ref.raw;
    invariant(instance);
    return instance;
  }

  /** The camera controller that manages view position, orientation, and projection. */
  get camera(): ThreeViewCamera {
    return this._camera;
  }

  /** The globe instance that manages terrain, imagery layers, and globe-specific settings. */
  get globe(): Globe {
    return this._globe;
  }

  /** The atmosphere renderer that handles sky, sun, and atmospheric scattering effects. */
  get atmosphere(): Atmosphere {
    return this._atmosphere;
  }

  /**
   * Gets the tone mapping exposure value.
   */
  get toneMappingExposure() {
    return this._renderer.toneMappingExposure;
  }
  /**
   * Sets the tone mapping exposure value for HDR rendering.
   */
  set toneMappingExposure(v: number) {
    this._renderer.toneMappingExposure = v;
    this.forceUpdate();
  }

  private get globeDepthTexture() {
    return this.renderPass.globeDepthCopyPass.texture;
  }

  /**
   * Returns whether mobile optimizations should be applied.
   * If `mobileOptimization` option is explicitly set, returns that value;
   * otherwise falls back to auto-detecting via `isMobileDevice()`.
   */
  isMobileOptimized(): boolean {
    const opt = this._options.mobileOptimization;
    return opt ?? isMobileDevice();
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

    const concurrencyManager = createDefaultConcurrencyManager(
      this.isMobileOptimized(),
    );

    initializeWorkerPool(WorkerURL, concurrencyManager);

    // Pre-warm all workers with WASM initialization
    const warmUpPromises: Promise<void>[] = [];
    for (let i = 0; i < concurrencyManager.total; i++) {
      warmUpPromises.push(warmUp());
    }

    // Asynchronous initialization in parallel.
    await Promise.all([...warmUpPromises, initCore(), initNavaraApi()]);

    this._core = new Core(newId());
    this._core.start();

    this._fontManager.setConcurrencyManager(concurrencyManager);

    this._globe = new Globe(this._globeHandler, this._options);

    // Set up Registry
    this.viewContext = new ViewContext(
      this._scenes,
      this.layersManager,
      this.renderPassOrchestrator,
      concurrencyManager,
    );
    this.registries = new Registries(this, this.viewContext);
    this.eventContext = new EventContext({
      eventManager: this._eventManager,
      scenes: this._scenes,
      camera: this._camera,
      meshes: this._meshes,
      abortControllers: this._abortControllers,
      buf: this._buf,
      texFragment: this._texFragment,
      tileHandler: this._tileHandler,
      workerTaskHandler: this._workerTaskHandler,
      meshHandler: this._meshHandler,
      featureHandler: this._featureHandler,
      loadedTexs: this._loadedTexs,
      workerPoolPromises: this._workerPoolPromises,
      uniforms: this._uniforms,
      texturizedSceneByTileCoordinates: this._texturizedSceneByTileCoordinates,
      tileMapByHandle: this._tileMapByHandle,
      textureOptions: this._defaultTextureOptions,
      renderFlag: this._renderFlag,
      viewEvents: this,
      layersManager: this.layersManager,
      viewContext: this.viewContext,
      layerHandler: this._layerHandler,
      fontManager: this._fontManager,
    });

    // Register built-in layers
    this.registerBuiltIns();

    if (!isWorker()) {
      this._eventDisposer = registerInputEvents(
        this._core,
        this._renderer.domElement,
      );
      this._pickHelper = new PickHelper(
        this._renderer.domElement,
        this._renderer,
        this._camera.raw,
        this._scenes,
        this._meshes,
        this.onPick.bind(this),
        this.renderPassOrchestrator.effectComposer.inputBuffer,
        this._globe,
        // {
        //   debug: true,
        // },
      );
      this._pickHelper.enablePick(this._options.picking ?? true);
    }

    await this.initializeRenderPass();

    this.viewContext._setRenderPass(this.renderPass);

    await Promise.all(this.plugins.map((p) => p.init(this, this.viewContext)));

    this._startMainLoop();

    const size = new Vector2();
    this._renderer.getSize(size);
    this.resize(size.width, size.height, this._renderer.getPixelRatio());

    this._camera.core = this._core;

    this._renderer.domElement.addEventListener("mousedown", (event) => {
      const mapEvent = this.convertMouseEventToMapEvent(event);
      if (mapEvent) {
        this.emit("mousedown", mapEvent);
      }
    });

    this._renderer.domElement.addEventListener("mouseenter", (event) => {
      const mapEvent = this.convertMouseEventToMapEvent(event);
      if (mapEvent) {
        this.emit("mouseenter", mapEvent);
      }
    });

    this._renderer.domElement.addEventListener("mouseleave", (event) => {
      const mapEvent = this.convertMouseEventToMapEvent(event);
      if (mapEvent) {
        this.emit("mouseleave", mapEvent);
      }
    });

    this._renderer.domElement.addEventListener("mousemove", (event) => {
      const mapEvent = this.convertMouseEventToMapEvent(event);
      if (mapEvent) {
        this.emit("mousemove", mapEvent);
      }
    });

    this._renderer.domElement.addEventListener("mouseup", (event) => {
      const mapEvent = this.convertMouseEventToMapEvent(event);
      if (mapEvent) {
        this.emit("mouseup", mapEvent);
      }
    });

    this._renderer.domElement.addEventListener("click", (event) => {
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
    if (!isWorker()) {
      window.removeEventListener("resize", this._handleResize);
      this.pixelRatioMatchedMedia?.removeEventListener(
        "change",
        this._handleResize,
      );
    }

    if (this._eventDisposer) {
      this._eventDisposer();
      this._eventDisposer = undefined;
    }

    if (this._pickHelper) {
      this._pickHelper.dispose();
      this._pickHelper = undefined;
    }

    if (this._terrainPicker) {
      this._terrainPicker.dispose();
    }

    this._fontManager.dispose();
    this._atmosphere._dispose();

    this.skyEnvMapLayer?.delete();
    this.mrtPassLayer?.delete();
    this.transparentPassLayer?.delete();
    this.finalPassLayer?.delete();

    // Abort all pending requests
    for (const controller of this._abortControllers.values()) {
      controller.abort();
    }
    this._abortControllers.clear();

    // Dispose loaded textures
    for (const tex of this._loadedTexs.values()) {
      tex.dispose();
    }
    this._loadedTexs.clear();

    // Clear caches and maps
    this._meshes.clear();
    this._workerPoolPromises.clear();
    this._tileMapByHandle.clear();

    // Clean up WASM core
    this._core?.free();
    this._core = undefined;

    if (this._stats) {
      this._stats.dom.remove();
      this._stats = undefined;
    }

    this._renderer.setAnimationLoop(null);
    if (
      "dispose" in this._renderer &&
      typeof this._renderer.dispose === "function"
    ) {
      this._renderer.dispose();
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

    this._camera.raw.aspect = w / h;
    this._camera.raw.updateProjectionMatrix();
    this._renderer.setSize(w, h, !isWorker());
    this.renderPassOrchestrator.setSize(w, h);
    if (this._options.pixelRatio == null && pixelRatio) {
      this._renderer.setPixelRatio(pixelRatio);
    }

    this._core?.resize(w, h, pixelRatio ?? 1);

    this.emit("resize", w, h);
  };

  private _updateUniforms() {
    const viewport = this._getCanvasSize();
    const pixelRatio = this._renderer.getPixelRatio();

    // Ref: https://github.com/CesiumGS/cesium/blob/2cf09cb06e4f7ea767da39befabcfc3444b02c49/packages/engine/Source/Core/PerspectiveFrustum.js#L208-L218
    const fovY = this._camera.fovy ?? 1;
    const top = this._camera.raw.near * Math.tan(0.5 * fovY);
    const bottom = -top;
    const right = this._camera.raw.aspect * top;
    const left = -right;

    this._uniforms.viewportAndPixelRatio.value = [
      viewport?.width ?? 0,
      viewport?.height ?? 0,
      pixelRatio,
    ];
    this._uniforms.frustumNearFar.value = [
      this._camera.raw.near,
      this._camera.raw.far,
    ];
    this._uniforms.frustumRatio.value = [top, bottom, right, left];
    this._uniforms.tGlobeDepth.value =
      this.renderPass.globeDepthCopyPass.texture;
    this._uniforms.tGlobeNormal.value =
      this.renderPass.globeNormalCopyPass.texture;
    this._uniforms.tSkyEnvMap.value =
      this.skyEnvMapLayer.ref.raw?.getEnvMapTexture() ?? null;
    this._uniforms.inverseProjectionMatrix.value =
      this._camera.raw.projectionMatrixInverse;

    // TODO: Need to sync `fov` with WASM side
    this._uniforms.fov.value = (this._camera.raw.fov * Math.PI) / 180;
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

    this.eventContext.updatedAt = updatedAt;

    processEvent(this.eventContext, events);
    events?.free();

    this._camera.raw.updateMatrixWorld();

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

    this._atmosphere._update();

    this.emit("preRender", updatedAt);

    this.renderPassOrchestrator.render();
    this._pickHelper?.renderDebugCanvas();

    this.shadowMapViewers.render(this._renderer);

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
   * Adds a new resource layer (GIS data layer) to the scene.
   * For meshes, lights, and effects, use `addMesh()`, `addLight()`, and `addEffect()` instead.
   * @param l - Resource layer configuration object specifying type and options
   * @returns A Layer for controlling the added layer
   */
  addLayer(l: LayerDescription): Layer {
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

    return layer;
  }

  /**
   * Adds a 3D mesh to the scene.
   * The mesh kind is determined by the nested key (e.g., `{ box: { width: 200 } }`).
   * @param desc - Mesh configuration object
   * @returns A MeshHandle for controlling the added mesh
   */
  addMesh<L extends MeshDesc = MeshDesc>(
    config: OmitType<MeshConfig | NonNullable<D["mesh"]>>,
  ): MeshHandle<L> {
    // Find which mesh type from config
    const meshType = this.registries.mesh.findMeshType(config);
    if (!meshType) {
      throw new UnknownTypeError(config);
    }

    // Create mesh layer instance
    const meshLayer = this.registries.mesh.create(meshType, config);

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
    meshLayer.on("needsUpdate", this.forceUpdate);

    const l = new MeshHandle(meshLayer);

    // Store the mesh layer
    this.layersManager.add(l);

    // Return handle for imperative access
    return l as MeshHandle<L>;
  }

  /**
   * Adds a light to the scene.
   * The light kind is determined by the nested key (e.g., `{ ambient: { intensity: 0.5 } }`).
   * @param desc - Light configuration object
   * @returns A LightHandle for controlling the added light
   */
  addLight<L extends LightDesc = LightDesc>(
    config: OmitType<LightConfig | NonNullable<D["light"]>>,
  ): LightHandle<L> {
    // Find which light type from config
    const lightType = this.registries.light.findLightType(config);
    if (!lightType) {
      throw new UnknownTypeError(config);
    }

    // Create light layer instance
    const lightLayer = this.registries.light.create(lightType, config);

    // Initialize the light
    lightLayer.onCreate();

    // Set up update listener if the layer has an update method
    if (lightLayer.update) {
      this.on("preRender", lightLayer.update.bind(lightLayer));
    }

    // Trigger re-render
    lightLayer.on("needsUpdate", this.forceUpdate);

    const l = new LightHandle(lightLayer);

    // Store the light layer
    this.layersManager.add(l);

    // Return handle for imperative access
    return l as LightHandle<L>;
  }

  /**
   * Adds a post-processing effect to the scene.
   * The effect kind is determined by the nested key (e.g., `{ bloom: { strength: 1.0 } }`).
   * @param desc - Effect configuration object
   * @returns An EffectHandle for controlling the added effect
   */
  addEffect<L extends EffectDesc = EffectDesc>(
    config: OmitType<
      BuiltInEffectDescription | EffectConfig | NonNullable<D["effect"]>
    >,
  ): EffectHandle<L> {
    // Find which effect type from config
    const effectType = this.registries.effect.findEffectType(config);
    if (!effectType) {
      throw new UnknownTypeError(config);
    }

    // Create effect layer instance
    const effectLayer = this.registries.effect.create(effectType, config);

    // Initialize the effect
    effectLayer.onCreate();

    // Set up update listener if the layer has an update method
    if (effectLayer.update) {
      this.on("preRender", effectLayer.update.bind(effectLayer));
    }

    // Trigger re-render
    effectLayer.on("needsUpdate", this.forceUpdate);

    const l = new EffectHandle(effectLayer);

    // Store the effect layer
    this.layersManager.add(l);

    // Return handle for imperative access
    return l as EffectHandle<L>;
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
    this.registerBuiltInEffects();
  }

  private registerBuiltInEffects(): void {
    this.registerEffect("skyEnvMap", SkyEnvMapEffectDesc);
    this.registerEffect("mrt", MRTPassEffectDesc);

    // SelectiveEffect effects
    this.registerEffect("selectiveBloom", SelectiveBloomEffectDesc);
    this.registerEffect("selectiveOutline", SelectiveOutlineEffectDesc);
    // TODO: Curve out opaque pass from MRT pass.
    // this.registerEffect("opaque", OpaquePassEffectLayer);
    this.registerEffect("transparent", TransparentPassEffectDesc);

    this.registerEffect("final", FinalCopyEffectDesc);
  }

  /**
   * Registers a custom mesh layer type for use with addMesh().
   * @param name - Unique name to identify this mesh type in layer configurations
   * @param meshClass - The mesh layer class constructor
   */
  registerMesh(name: string, meshClass: MeshLayerConstructor): void {
    this.registries.mesh.register(name, meshClass);
  }

  /**
   * Registers a custom light layer type for use with addLight().
   * @param name - Unique name to identify this light type in layer configurations
   * @param lightClass - The light layer class constructor
   */
  registerLight(name: string, lightClass: LightLayerConstructor): void {
    this.registries.light.register(name, lightClass);
  }

  /**
   * Registers a custom post-processing effect layer type for use with addEffect().
   * @param name - Unique name to identify this effect type in layer configurations
   * @param effectClass - The effect layer class constructor
   */
  registerEffect(name: string, effectClass: EffectLayerConstructor): void {
    this.registries.effect.register(name, effectClass);
  }

  /**
   * Adds a plugin to the view. Plugins are initialized during `init()`.
   * Must be called before `init()`.
   * @param plugin - The plugin instance to add
   * @returns This view instance for chaining
   */
  addPlugin(plugin: Plugin): this {
    if (this._initialized)
      throw new Error("Plugin must be added before `view.init()`.");
    this.plugins.push(plugin);
    return this;
  }

  /**
   * Register a font family with multiple faces.
   * Each face covers a set of unicode ranges and points to a separate font file URL.
   * When a text label uses this family name as its font, only the face files
   * whose unicode ranges cover the label's characters are loaded.
   *
   * @example
   * ```ts
   * view.addFontFamily({
   *   family: "MapFont",
   *   faces: [
   *     {
   *       url: "/fonts/latin.woff2",
   *       unicodeRanges: [{ from: 0x0000, to: 0x024f }],
   *     },
   *     {
   *       url: "/fonts/cjk.woff2",
   *       unicodeRanges: [{ from: 0x4e00, to: 0x9fff }],
   *     },
   *   ],
   * });
   * ```
   */
  addFontFamily(family: FontFamily): this {
    this._fontManager.registerFontFamily(family);
    return this;
  }

  /** Remove a previously registered font family by name. */
  removeFontFamily(family: string): this {
    this._fontManager.unregisterFontFamily(family);
    return this;
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
    this._renderer.setAnimationLoop(loop);
  }

  private _getCanvasSize(): { width: number; height: number } | undefined {
    const element =
      this._options.container ??
      this._renderer.domElement?.parentElement ??
      this._renderer.domElement;
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
  private onPick(pickArr: number[]) {
    this._renderFlag.forceUpdate = true;

    if (pickArr.length > 0) {
      const prop = this._core?.readPropertyByGlobalBatchId(pickArr[0]);
      if (prop) {
        const pickedFeature: PickedFeature = {
          properties: prop.properties,
          batchId: pickArr[0],
          layerId: prop.layerId,
        };
        this.emit("pick", pickedFeature);
      } else {
        const emptyFeature: PickedFeature = {
          properties: {},
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
    this._renderer.getSize(size);
    return size;
  }

  /**
   * Gets the current device pixel ratio.
   */
  get pixelRatio() {
    return this._renderer.getPixelRatio();
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
   * Picks the terrain position at screen coordinates.
   * @param x - Screen X coordinate in CSS pixels (same as MouseEvent.clientX)
   * @param y - Screen Y coordinate in CSS pixels (same as MouseEvent.clientY)
   * @returns World position Vector3 in ECEF coordinates, or null if no terrain is hit
   */
  pickTerrainPosition(x: number, y: number): Nullable<Vector3> {
    return this._terrainPicker.pick(
      x,
      y,
      this._renderer,
      this.globeDepthTexture,
      this._camera.raw,
    );
  }
}

function newId() {
  return Math.random().toString(36).slice(2);
}
