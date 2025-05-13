import { EventManager, EventHandler } from "@navara/core";
import initCore, {
  Core,
  CameraDirection,
  type TextureFragmentStatus,
} from "@navara/engine";
import { initializeWorkerPool } from "@navara/worker";
import { EffectComposer, EffectPass } from "postprocessing";
import {
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  Vector3,
  Texture,
  Vector2,
  WebGLRenderTarget,
  FloatType,
  Material,
  NearestFilter,
  DepthTexture,
  DirectionalLight,
  AmbientLight,
  Color,
  type Vector3Tuple,
  HalfFloatType,
  LinearFilter,
} from "three";
import invariant from "tiny-invariant";

import { selectAntialiasEffect, type Antialias } from "./antialias";
import { MAP_CONCURRENCY } from "./concurrency";
import {
  processEvent,
  type BufferLoader,
  type FeatureHandler,
  type MeshHandler,
  type TextureFragmentHandler,
  type TileHandler,
  type WorkerTaskHandler,
} from "./event";
import { registerInputEvents } from "./input";
import { Layer, type LayerEvent } from "./layer";
import { LayersManager } from "./layersManager";
import type { Light } from "./light";
import { PickHelper } from "./pickHelper";
import type { Picking } from "./picking";
import { CustomRenderPass } from "./renderPass";
import { TexturizedSceneByTileCoordinates, type Scenes } from "./scene";
import { RendererStats } from "./stats";
import type { TextureOptions } from "./textures";
import {
  type AbortControllers,
  type LayerDescription,
  type MeshCache,
  type PickedFeature,
  type WorkerPoolPromises,
  type RenderFlag,
  type CameraPosition,
} from "./type";
import type { CommonUniforms } from "./uniforms";
import { isWorker } from "./utils";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
/** @ts-ignore ignore: https://v3.vitejs.dev/guide/features.html#import-with-query-suffixes  */
import WorkerURL from "./worker?url&worker";

export * from "./type";
export * from "./types";
export * from "./constants";
export * from "./light";
export * from "./antialias";
export * from "./mesh";
export * from "./layer";

export type Options = {
  container?: HTMLElement;
  canvas?: HTMLCanvasElement | OffscreenCanvas;
  initialWidth?: number;
  initialHeight?: number;
  initialPixelRatio?: number;
  disableAutoResize?: boolean;
  debug?: boolean;
  scene?: Scene;
  globeScene?: Scene;
  camera?: PerspectiveCamera;
  renderer?: WebGLRenderer;
  antialias?: Antialias;
  light?: Light;
  backgroundColor?: number;
  picking?: Picking;
  // The number of samples for MSAA.
  multisampling?: number;
  // This affects how the post-processing shader handles floating point numbers. `true` would be high quality.
  halfFloat?: boolean;
};

export type ViewEvents = {
  resize: () => void;
  pick: (info: PickedFeature) => void;
  layer: <K extends keyof LayerEvent>(
    k: K,
    layerId: string,
    ...args: Parameters<LayerEvent[K]>
  ) => void;
  preUpdate: (t: number) => void;
  postUpdate: (t: number) => void;
};

export default class ThreeView extends EventHandler<ViewEvents> {
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  control?: { update: () => void; get target(): Vector3 | undefined };

  private _scenes: Scenes;
  private _effectComposer: EffectComposer;
  private _renderPass: CustomRenderPass;
  private _globeGBufferRenderTarget: WebGLRenderTarget;
  // Store draped feature's materials
  private _drapedFeatureMaterials = new Map<string, Material>();

  private _core: Core | undefined;
  private _options: Options;
  private _stats: RendererStats | undefined;
  private _eventDisposer: (() => void) | undefined;
  private _disposed = false;
  private _renderFlag: RenderFlag = {
    forceUpdate: false,
  };
  private _uniforms: CommonUniforms;

  private _meshes: MeshCache = new Map();
  private _abortControllers: AbortControllers = new Map();
  private _workerPoolPromises: WorkerPoolPromises = new Map();
  private _loadedTexs = new Map<string, Texture>();
  private _texturizedSceneByTileCoordinates: TexturizedSceneByTileCoordinates;

  private _buf: BufferLoader = {
    u8: (handle) => {
      const b = this._core?.getBufferU8(handle);
      return b ?? null;
    },
    f32: (handle) => {
      const b = this._core?.getBufferF32(handle);
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
  private _defaultTextureOptions: TextureOptions;
  private layersManager = new LayersManager();

  constructor(options: Options = {}) {
    super();

    if (!options.canvas) {
      const div = document.createElement("div");
      div.id = "root";
      div.style.width = "100vw";
      div.style.height = "100vh";

      options.canvas = document.createElement("canvas");
      options.canvas.id = "canvas";
      options.canvas.style.width = "100%";
      options.canvas.style.height = "100%";

      div.appendChild(options.canvas);

      document.body.appendChild(div);
    }

    this._options = options;

    // disable right-click
    options.canvas?.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });

    if (options.renderer) {
      this.renderer = options.renderer;
    } else {
      const renderer = new WebGLRenderer({
        // If it's true, some noise will happen. So use other AA algorithm instead.
        antialias: false,
        logarithmicDepthBuffer: true,
        canvas: options.canvas,
        stencil: true,
      });
      renderer.info.autoReset = false;
      renderer.autoClearStencil = false;
      renderer.autoClearColor = false;
      renderer.autoClearDepth = false;
      this.renderer = renderer;

      const { width = options.initialWidth, height = options.initialHeight } =
        this._getCanvasSize() ?? {};
      invariant(width && height);

      if (typeof options?.initialPixelRatio === "number" || !isWorker()) {
        const defaultPixelRatio = isWorker() ? 1 : window.devicePixelRatio;
        renderer.setPixelRatio(options.initialPixelRatio ?? defaultPixelRatio);
      }

      renderer.setSize(width, height, !isWorker());
      if (options.container) {
        options.container.appendChild(renderer.domElement);
      }
    }

    this._texturizedSceneByTileCoordinates =
      new TexturizedSceneByTileCoordinates(this.renderer);

    // Setup RenderTarget for depth buffer
    const { width = options.initialWidth, height = options.initialHeight } =
      this._getCanvasSize() ?? {};
    invariant(width && height);
    const pixelRatio = this.renderer.getPixelRatio();
    const scaledWidth = width * pixelRatio;
    const scaledHeight = height * pixelRatio;
    this._globeGBufferRenderTarget = new WebGLRenderTarget(
      scaledWidth,
      scaledHeight,
      {
        count: 1,
      },
    );
    this._globeGBufferRenderTarget.depthTexture = new DepthTexture(
      scaledWidth,
      scaledHeight,
    );
    const normalBuffer = this._globeGBufferRenderTarget.textures[0];
    normalBuffer.magFilter = NearestFilter;
    normalBuffer.minFilter = NearestFilter;
    normalBuffer.type = FloatType;

    let scene: Scene;
    if (options.scene) {
      scene = options.scene;
    } else {
      scene = new Scene();
    }

    let globeScene: Scene;
    if (options.globeScene) {
      globeScene = options.globeScene;
    } else {
      globeScene = new Scene();
    }

    const main = new Scene();
    const drapedFeaturesScene = new Scene();

    const globeGBufferScene = new Scene();

    this._scenes = {
      world: scene,
      main,
      globe: globeScene,
      globeGBuffer: globeGBufferScene,
      drapedFeatures: drapedFeaturesScene,
    };

    if (options.camera) {
      this.camera = options.camera;
    } else {
      const { width = options.initialWidth, height = options.initialHeight } =
        this._getCanvasSize() ?? {};
      if (typeof width !== "number" || typeof height !== "number") {
        throw new Error("Must provide initialWidth and initialHeight");
      }

      const camera = new PerspectiveCamera(50, width / height);
      camera.far = 1e8; // 100,000 km
      camera.near = 1;
      const earthRadius = 6371000;
      camera.position.set(0, 0, earthRadius * 3);
      camera.up.set(0, 0, 1);
      camera.lookAt(0, 0, 0);
      this.camera = camera;
    }

    // Setup render pass
    this._effectComposer = new EffectComposer(this.renderer, {
      stencilBuffer: true,
      frameBufferType: options.halfFloat ? HalfFloatType : undefined,
      multisampling: options.multisampling,
    });
    this._effectComposer.setSize(width, height);

    this._renderPass = new CustomRenderPass(
      this._scenes,
      this.camera,
      this._meshes,
      this._globeGBufferRenderTarget,
      this._drapedFeatureMaterials,
    );
    this._effectComposer.addPass(this._renderPass);

    // AA
    const aaEffect = selectAntialiasEffect(options.antialias);
    if (aaEffect) {
      const aaPass = new EffectPass(this.camera, aaEffect);
      this._effectComposer.addPass(aaPass);
    }

    // TODO: Replace it with the aerial perspective.
    // Light
    const light = options.light;
    if (light?.ambient?.enabled ?? true) {
      const ambientLight = new AmbientLight(
        light?.ambient?.color ?? 0xffffff,
        light?.ambient?.intensity ?? 1,
      );
      this.scene.add(ambientLight);
    }
    if (light?.sun?.enabled ?? true) {
      const directionalLight = new DirectionalLight(
        light?.sun?.color ?? 0xffffff,
        light?.sun?.intensity ?? 3,
      );
      directionalLight.position.set(
        ...(light?.sun?.position
          ? light.sun.position.toArray()
          : ([1, 5, 3] as Vector3Tuple)),
      );
      this.scene.add(directionalLight);
    }

    // Background color
    this.renderer.setClearColor(options.backgroundColor ?? 0x0a0a0f);

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
      inverseProjectionMatrix: { value: null },
      highlightColor: {
        value: options.picking?.highlightColor ?? new Color(0x00ffff),
      },
      // TODO: Need to sync `fov` with WASM side
      fov: { value: (this.camera.fov * Math.PI) / 180 },
      screenHeightPx: { value: height },
    };

    this._defaultTextureOptions = {
      maxAnisotropy: this.renderer.capabilities.getMaxAnisotropy(),
      magFilter: LinearFilter,
      minFilter: LinearFilter,
      useMipmaps: true,
      maxTextures: Math.max(this.renderer.capabilities.maxTextures, 8),
    };

    this.on("layer", (e, id, ...args) => {
      this.layersManager.emitById(e, id, ...args);
    });
  }

  get scene() {
    return this._scenes.world;
  }

  get effectComposer() {
    return this._effectComposer;
  }

  async init() {
    if (this._core) return;

    initializeWorkerPool(WorkerURL, MAP_CONCURRENCY);

    await initCore();

    this._core = new Core(newId());
    this._core.start();
    if (!isWorker()) {
      this._eventDisposer = registerInputEvents(
        this._core,
        this.renderer.domElement,
      );
      this._pickHelper = new PickHelper(
        this.renderer.domElement,
        this.renderer,
        this.camera,
        this._scenes,
        this._meshes,
        this._drapedFeatureMaterials,
        this._globeGBufferRenderTarget,
        this._options.picking?.highlightColor ?? new Color(0x00ffff),
        this.onPick.bind(this),
        // {
        //   debug: true,
        // },
      );
      this._pickHelper.enablePick(this._options.picking?.enable ?? true);
    }

    this._startMainLoop();

    const size = new Vector2();
    this.renderer.getSize(size);
    this.resize(size.width, size.height, this.renderer.getPixelRatio());
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

    this._globeGBufferRenderTarget.dispose();

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

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, !isWorker());
    this._effectComposer.setSize(w, h);
    this._globeGBufferRenderTarget.setSize(
      w * (pixelRatio ?? 1),
      h * (pixelRatio ?? 1),
    );
    if (pixelRatio) {
      this.renderer.setPixelRatio(pixelRatio);
    }

    this._core?.resize(w, h, pixelRatio ?? 1);

    this.emit("resize");
  };

  private _updateUniforms() {
    const viewport = this._getCanvasSize();
    const pixelRatio = this.renderer.getPixelRatio();

    // Ref: https://github.com/CesiumGS/cesium/blob/2cf09cb06e4f7ea767da39befabcfc3444b02c49/packages/engine/Source/Core/PerspectiveFrustum.js#L208-L218
    // TODO: Need to get this value from WASM side, and near, far as well.
    // const fovY = 0.7245411;
    const fovY = 1;
    const top = this.camera.near * Math.tan(0.5 * fovY);
    const bottom = -top;
    const right = this.camera.aspect * top;
    const left = -right;

    this._uniforms.viewportAndPixelRatio.value = [
      viewport?.width ?? 0,
      viewport?.height ?? 0,
      pixelRatio,
    ];
    this._uniforms.frustumNearFar.value = [this.camera.near, this.camera.far];
    this._uniforms.frustumRatio.value = [top, bottom, right, left];
    this._uniforms.tGlobeDepth.value =
      this._globeGBufferRenderTarget.depthTexture;
    this._uniforms.tGlobeNormal.value =
      this._globeGBufferRenderTarget.textures[0];
    this._uniforms.inverseProjectionMatrix.value =
      this.camera.projectionMatrixInverse;

    // TODO: Need to sync `fov` with WASM side
    this._uniforms.fov.value = (this.camera.fov * Math.PI) / 180;
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

    this._updateUniforms();

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
      this._defaultTextureOptions,
      this._renderFlag,
      this,
      this.layersManager,
      updatedAt,
    );
    events?.free();

    this.control?.update();
    this.camera.updateMatrixWorld();

    this.emit("postUpdate", updatedAt);

    return true;
  }

  /**
   * Process feature updates for all layers
   * This is called after the main update loop to batch feature updates
   */
  private _forceFeatureUpdates(updatedAt: number) {
    // Process updates for each layer
    for (const layer of this.layersManager._layers.values()) {
      if (layer._processFeatureUpdates(updatedAt)) {
        this._renderFlag.forceUpdate = true;
      }
    }
  }

  private _render() {
    this._effectComposer.render();
    this._pickHelper?.renderDebugCanvas();
  }

  addLayer(l: LayerDescription) {
    const layerId = this._core?.addLayer(l);
    invariant(layerId);
    invariant(this._core);

    const layer = new Layer(layerId, this._core);
    this.layersManager.add(layer);

    return layer;
  }

  updateLayerById(layerId: string, l: LayerDescription) {
    invariant(this._core);
    this.layersManager.get(layerId)?.update(l);
  }

  deleteLayerById(layerId: string) {
    invariant(this._core);
    this.layersManager.get(layerId)?.delete();
  }

  setCamera(camPos: CameraPosition) {
    const position =
      camPos.longitude && camPos.latitude && camPos.altitude
        ? new Float32Array([camPos.longitude, camPos.latitude, camPos.altitude])
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

    this._core?.moveCameraWithDirection(new Float32Array(dir), amount);
  }

  flyTo(
    camPos: CameraPosition &
      Required<Pick<CameraPosition, "longitude" | "latitude" | "altitude">>,
    duration?: number,
    maxHeight?: number,
  ) {
    const position = new Float32Array([
      camPos.longitude,
      camPos.latitude,
      camPos.altitude,
    ]);

    this._core?.flyTo(
      position,
      camPos.pitch,
      camPos.heading,
      camPos.roll,
      duration,
      maxHeight,
    );
  }

  private _startMainLoop() {
    const loop: XRFrameRequestCallback = (time) => {
      if (this._disposed) return;
      this._stats?.begin();

      this._forceFeatureUpdates(time);

      if (this._update(time) || this._renderFlag.forceUpdate) this._render();
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
      ? (this._options.initialPixelRatio ?? 1)
      : window.devicePixelRatio;
    this.resize(width, height, pixelRatio);
  };

  onPick(pickArr: number[]): number[] {
    this._renderFlag.forceUpdate = true;

    if (pickArr.length > 0) {
      const prop = this._core?.getBatchProp(pickArr[0]);
      if (prop) {
        const pickedFeature: PickedFeature = {
          properties: prop,
        };
        this.emit("pick", pickedFeature);
      }

      // for highlight
      const pickedBatchIds = this._core?.getPickedBatchIds(pickArr[0]);
      if (pickedBatchIds) {
        return Array.from(pickedBatchIds);
      }
    } else {
      this._core?.clearPickingStatus();
    }

    return [];
  }
}

function newId() {
  return Math.random().toString(36).slice(2);
}
