import { EventManager, EventHandler, Globe } from "@navara/core";
import type {
  CameraPosition,
  ColorMap,
  GlobeOptions,
  Nullable,
  XYZ,
  Color as CoreColor,
} from "@navara/core";
import initCore, {
  Core,
  CameraDirection,
  LLE,
  type TerrainHeightUpdatedEvent,
  type TextureFragmentStatus,
} from "@navara/engine";
import { initNavaraApi, LLE as ApiLLE } from "@navara/three_api";
import { initializeWorkerPool } from "@navara/worker";
import {
  Scene,
  WebGLRenderer,
  Vector3,
  Texture,
  Vector2,
  LinearFilter,
  ClampToEdgeWrapping,
  Group,
  Material,
  PCFSoftShadowMap,
} from "three";
import invariant from "tiny-invariant";

import { Atmosphere, type AtmosphereOptions } from "./atmosphere";
import { ThreeViewCamera } from "./camera";
import { Color } from "./Color";
import { MAP_CONCURRENCY } from "./concurrency";
import {
  LayerDeclaration,
  ViewContext,
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
  ToneMappingEffectLayer,
  RainDropEffectLayer,
  TransparentPassEffectLayer,
  DepthOfFieldEffectLayer,
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
import type { Picking } from "./pick/picking";
import { TerrainPicker } from "./pick/pickTerrain";
import { TexturizedSceneByTileCoordinates, type Scenes } from "./scene";
import { ShadowMapViewers } from "./ShadowMapViewers";
import { RendererStats } from "./stats";
import type { TextureOptions } from "./textures";
import {
  type AbortControllers,
  type LayerDescription as ActualLayerDescription,
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
export type { Nullable, XYZ, LngLat, LngLatHeight } from "@navara/core";
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

// CSM exports for advanced users
export { CascadedShadowMaps, CSMHelper } from "@navara/three_csm";

// NOTE:
// This overrides all materials to output a normal buffer, meaning Navara operates using MRT (Multiple Render Targets).
// Currently, Navara requires two buffers, so your shader must output them.
overrideMaterialsForMRT();

export type Options = {
  container?: HTMLElement;
  canvas?: HTMLCanvasElement | OffscreenCanvas;
  pixelRatio?: number;
  disableAutoResize?: boolean;
  debug?: boolean;
  atmosphere?: AtmosphereOptions;
  backgroundColor?: CoreColor;
  picking?: Picking;
  // The main loop runs every frame if it's true. Otherwise, it runs whenever a change occurs or `forceUpdate` is invoked.
  animation?: boolean;
  // The number of samples for MSAA.
  multisampling?: number;
  // This affects how the post-processing shader handles floating point numbers. `true` would be high quality.
  // Default=true
  halfFloat?: boolean;
  logarithmicDepthBuffer?: boolean;
  // It must be passed when instantiated.
  shadow?: boolean;
  // Enable mobile device optimizations such as lower pixel ratio.
  mobileOptimization?: boolean;
} & GlobeOptions;

export type MapMouseEvent = {
  map: XYZ;
} & MouseEvent;

export type ViewEvents = {
  resize: (w: number, h: number) => void;
  pick: (info: Nullable<PickedFeature>) => void;
  layer: <K extends keyof LayerEvent>(
    k: K,
    layerId: string,
    ...args: Parameters<LayerEvent[K]>
  ) => void;
  /** Emitted before an update process happens */
  preUpdate: (t: number) => void;
  /**
   * Emitted after an update process happened only when any states are changed.
   * */
  postUpdate: (t: number) => void;
  /**
   * Emitted before a rendering process happened.
   * Enabling `animation` flag emits this event every frame.
   * */
  preRender: (t: number) => void;
  /**
   * Emitted after a rendering process happened.
   * Enabling `animation` flag emits this event every frame.
   * */
  postRender: (t: number) => void;
  _sample_terrain_height_received: (ev: TerrainHeightUpdatedEvent) => void;
  /**
   * This event injects a shader code for CSM. The shader code only executed when the shadow is enabled.
   * You should pass a material that needs the shadow when it's initialized.
   */
  _csmMounted: (material: Material) => void;
  _csmUnmounted: (material: Material) => void;

  // Mouse events
  mousedown: (event: MapMouseEvent) => void;
  mouseenter: (event: MapMouseEvent) => void;
  mouseleave: (event: MapMouseEvent) => void;
  mousemove: (event: MapMouseEvent) => void;
  mouseup: (event: MapMouseEvent) => void;
  click: (event: MapMouseEvent) => void;
};

export default class ThreeView<
  CustomLayerDescriptions extends
    | Record<string, unknown>
    | undefined = undefined,
  LayerDescription extends
    ActualLayerDescription = CustomLayerDescriptions extends undefined
    ? ActualLayerDescription
    : ActualLayerDescription | CustomLayerDescriptions,
> extends EventHandler<ViewEvents> {
  camera: ThreeViewCamera;
  renderer: WebGLRenderer;
  control?: { update: () => void; get target(): Vector3 | undefined };

  globe!: Globe;
  atmosphere: Atmosphere;

  // Layers
  skyEnvMapLayer?: LayerHandle<SkyEnvMapEffectLayer>;
  mrtPassLayer!: LayerHandle<MRTPassEffectLayer>;
  transparentPassLayer!: LayerHandle<TransparentPassEffectLayer>;
  finalPassLayer!: LayerHandle<FinalCopyEffectLayer>;

  // Public access to render pass orchestrator for flexible pass management
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
  private viewContext: ViewContext;

  // Registry support
  private registries: Registries;

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

    this.atmosphere = new Atmosphere(this.renderer, options.atmosphere);
    this.atmosphere.on("_needsUpdate", this.forceUpdate);

    // Set up Registry
    this.viewContext = new ViewContext(
      this._scenes,
      this.camera.raw,
      this.atmosphere,
      this.layersManager,
      this.renderPassOrchestrator,
      {
        meshes: this._meshes,
        drapedMaterials: this._drapedFeatureMaterials,
      },
      this,
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

  async initializeRenderPass() {
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

  get toneMappingExposure() {
    return this.renderer.toneMappingExposure;
  }
  set toneMappingExposure(v: number) {
    this.renderer.toneMappingExposure = v;
    this.forceUpdate();
  }

  get globeDepthTexture() {
    return this.renderPass.globeDepthCopyPass.texture;
  }

  get globeNormalTexture() {
    return this.renderPass.globeNormalCopyPass.texture;
  }

  get normalTexture() {
    return this.renderPass.gbufferRenderTarget.textures[1];
  }

  forceUpdate = () => {
    this._renderFlag.forceUpdate = true;
  };

  async init() {
    if (this._core || this._initialized) return;

    this._initialized = true;

    initializeWorkerPool(WorkerURL, MAP_CONCURRENCY);

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
      this._pickHelper.enablePick(this._options.picking?.enable ?? true);
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

    this.renderer.setAnimationLoop(null);
    if (
      "dispose" in this.renderer &&
      typeof this.renderer.dispose === "function"
    ) {
      this.renderer.dispose();
    }
  }

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
      updatedAt,
    );
    events?.free();

    this.control?.update();
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

    layer.setDescription(processedLayer);

    this.layersManager.add(layer);

    return layer as L extends LayerDeclaration ? never : Layer; // TODO: Remove this cast later.
  }

  updateLayerById(layerId: string, l: LayerDescription) {
    invariant(this._core);
    // Convert all Color objects to numbers before updating
    const processedLayer = this._convertColorsToNumbers(l) as LayerDescription;
    this.layersManager.get(layerId)?.update(processedLayer);
  }

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

  registerMesh(name: string, meshClass: MeshLayerConstructor): void {
    this.registries.mesh.register(name, meshClass);
  }

  registerLight(name: string, lightClass: LightLayerConstructor): void {
    this.registries.light.register(name, lightClass);
  }

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

    sunLightLayer.setupMaterialForShadows(material);
  }

  /**
   * Remove CSM for a single material
   */
  private removeCSMForMaterial(material: Material): void {
    const sunLightLayer = this.findSunLightLayer();
    if (!sunLightLayer) {
      return;
    }

    sunLightLayer.removeMaterialFromShadows(material);
  }

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
   * Adds default effect layers for rendering.
   * On mobile devices (when mobileOptimization is enabled), uses lighter-weight effects.
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

  // Debug helper to see effect pass order
  getEffectOrder(): string[] {
    return this.renderPassOrchestrator.getPassNames();
  }

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

  moveCamera(move: string, amount: number) {
    switch (move) {
      case "Forward":
        this._core?.moveCamera(CameraDirection.Forward, amount);
        break;
      case "Backward":
        this._core?.moveCamera(CameraDirection.Backward, amount);
        break;
      case "Up":
        this._core?.moveCamera(CameraDirection.Up, amount);
        break;
      case "Down":
        this._core?.moveCamera(CameraDirection.Down, amount);
        break;
      case "Left":
        this._core?.moveCamera(CameraDirection.Left, amount);
        break;
      case "Right":
        this._core?.moveCamera(CameraDirection.Right, amount);
        break;
      default:
        break;
    }
  }

  moveCameraWithDirection(dir: number[], amount: number) {
    if (dir.length !== 3) {
      return;
    }

    this._core?.moveCameraWithDirection(new Float64Array(dir), amount);
  }

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

  lookAt(target: ApiLLE, offset: Vector3) {
    this._core?.lookAt(
      new Float64Array([target.lng, target.lat, target.height]),
      new Float64Array([offset.x, offset.y, offset.z]),
    );
  }

  cameraFollow(enabled: boolean, target?: ApiLLE, offset?: Vector3) {
    const targetArray = target
      ? new Float64Array([target.lng, target.lat, target.height])
      : undefined;
    const offsetArray = offset
      ? new Float64Array([offset.x, offset.y, offset.z])
      : undefined;

    this._core?.cameraFollow(enabled, targetArray, offsetArray);
  }

  sampleTerrainHeight(pos: ApiLLE): number | undefined {
    const lle = new LLE(pos.lat, pos.lng, 0);
    return this._core?.sampleTerrainHeight(lle);
  }

  addTerrainHeightEvent(pos: ApiLLE, cb: (height: number) => void): () => void {
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

  rotateAroundAxis(axis: Vector3, angle: number) {
    const isZero = axis.x === 0 && axis.y === 0 && axis.z === 0;

    this._core?.rotateAroundAxis(
      isZero ? undefined : new Float64Array([axis.x, axis.y, axis.z]),
      angle,
    );
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

  get animation() {
    return this._renderFlag.animation;
  }
  set animation(v: boolean) {
    this._renderFlag.animation = v;
  }

  get screenSize() {
    const size = new Vector2();
    this.renderer.getSize(size);
    return size;
  }

  get pixelRatio() {
    return this.renderer.getPixelRatio();
  }

  /**
   * Display shadow map on the left side of your screen.
   */
  get shadowMapViewersEnabled() {
    return this.shadowMapViewers.enabled;
  }
  set shadowMapViewersEnabled(v: boolean) {
    this.shadowMapViewers.enabled = v;
  }

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
