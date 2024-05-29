import initCore, { Core, TextureFragmentStatus } from "map-engine-prototype";
import Stats from "stats.js";
import { PerspectiveCamera, Scene, WebGLRenderer, Mesh, TextureLoader, Vector3, Texture, Vector2 } from "three";

import { C3TilesManager } from "./C3Tiles";
import { processEvent, type BufferLoader, type TextureFragmentHandler } from "./event";
import { registerInputEvents } from "./input";
import MVT from "./MVT";
import { type LayerDescription } from "./type";
import { isWorker } from "./utils";

export type Options = {
  container?: HTMLElement;
  canvas?: HTMLCanvasElement | OffscreenCanvas;
  initialWidth?: number;
  initialHeight?: number;
  initialPixelRatio?: number;
  disableAutoResize?: boolean;
  debug?: boolean;
  scene?: Scene;
  camera?: PerspectiveCamera;
  renderer?: WebGLRenderer;
};

export type Events = {
  resize: () => void;
};

export default class ThreeView {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;

  _core: Core | undefined;
  _options: Options;
  _stats: Stats | undefined;
  _eventDisposer: (() => void) | undefined;
  _disposed = false;
  _events: {
    [K in keyof Events]?: Events[K][];
  } = {};

  _meshes: Map<string, Mesh> = new Map();
  _loadedTexs: Map<string, Texture> = new Map();
  _tex = new TextureLoader();
  _buf: BufferLoader = {
    u8: handle => {
      const b = this._core?.getBufferU8(handle);
      return b ?? null;
    },
    f32: handle => {
      const b = this._core?.getBufferF32(handle);
      return b ?? null;
    },
    u32: handle => {
      const b = this._core?.getBufferU32(handle);
      return b ?? null;
    },
    setU8: (handle: number, b: Uint8Array) => {
      this._core?.setBufferU8(handle, b);
    },
  };
  _texFragment: TextureFragmentHandler = {
    triggerTextureFragmentLoaded: (bits: bigint, status: TextureFragmentStatus) => {
      this._core?.triggerTextureFragmentLoaded(bits, status);
    },
  };

  control?: { update: () => void; get target(): Vector3 | undefined };

  constructor(options: Options) {
    if (!options.container && !options.canvas && !options.renderer) {
      throw new Error("Must provide either target, canvas, or renderer");
    }

    this._options = options;

    // disable right-click
    options.canvas?.addEventListener("contextmenu", e => {
      e.preventDefault();
    });

    if (options.renderer) {
      this.renderer = options.renderer;
    } else {
      const renderer = new WebGLRenderer({
        antialias: true,
        logarithmicDepthBuffer: true,
        canvas: options.canvas,
      });
      this.renderer = renderer;
      const { width = options.initialWidth, height = options.initialHeight } =
        this._getCanvasSize() ?? {};
      if (typeof width !== "number" || typeof height !== "number") {
        throw new Error("Must provide initialWidth and initialHeight");
      }

      if (typeof options?.initialPixelRatio === "number" || !isWorker()) {
        const defaultPixelRatio = isWorker() ? 1 : window.devicePixelRatio;
        renderer.setPixelRatio(options.initialPixelRatio ?? defaultPixelRatio);
      }

      renderer.setSize(width, height, !isWorker());
      if (options.container) {
        options.container.appendChild(renderer.domElement);
      }
    }

    if (options.scene) {
      this.scene = options.scene;
    } else {
      const scene = new Scene();
      this.scene = scene;
    }

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
      camera.near = 0.1;
      const earthRadius = 6371000;
      camera.position.set(0, 0, earthRadius * 3);
      camera.up.set(0, 0, 1);
      camera.lookAt(0, 0, 0);
      this.camera = camera;
    }

    if (!options.disableAutoResize && !isWorker()) {
      window.addEventListener("resize", this._resize);
    }

    if (options.debug) {
      const t = options.container || this.renderer.domElement.parentElement;
      if (t) {
        this._stats = new Stats();
        t.appendChild(this._stats.dom);
      }
    }

    // orbit
    // this.control = new MapControls(this.camera, this.renderer.domElement);

    // c3tiles
    this._c3tiles = new C3TilesManager(this.scene, this.camera, this.renderer, this.control);
  }

  async init() {
    if (this._core) return;

    await initCore();

    this._core = new Core(newId());
    this._core.start();
    if (!isWorker()) {
      this._eventDisposer = registerInputEvents(this._core, this.renderer.domElement);
    }

    this._startMainLoop();

    const size = new Vector2();
    this.renderer.getSize(size);
    this.resize(size.width, size.height, this.renderer.pixelRatio);
  }

  dispose() {
    this._disposed = true;
    if (!isWorker()) window.removeEventListener("resize", this._resize);
    if (this._eventDisposer) {
      this._eventDisposer();
      this._eventDisposer = undefined;
    }
    if ("dispose" in this.renderer && typeof this.renderer.dispose === "function") {
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
    if (
      typeof pixelRatio === "number" &&
      "setPixelRatio" in this.renderer &&
      typeof this.renderer.setPixelRatio === "function"
    ) {
      this.renderer.setPixelRatio(pixelRatio);
    }

    this._core?.resize(w, h, pixelRatio ?? 1);

    this._emit("resize");
  };

  /** Returns true if the scene was updated and needs to be rendered. */
  update(): boolean {
    this._core?.update();

    const events = this._core?.readEvents();
    if (events && this._core) {
      processEvent
        ( this.scene,
          this.camera,
          this._meshes,
          this._buf,
          this._texFragment,
          this._loadedTexs,
          this._tex,
          events);
    }

    this.control?.update();
    this.camera.updateMatrixWorld();
    this._c3tiles.update();

    return true;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  on<K extends keyof Events>(event: K, callback: Events[K]) {
    if (!this._events[event]) this._events[event] = [];
    this._events[event]?.push(callback);
  }

  off<K extends keyof Events>(event: K, callback: Events[K]) {
    this._events[event] = this._events[event]?.filter(c => c !== callback);
  }

  setBuffer(handle: number, data: Uint8Array) {
    this._core?.setBufferU8(handle, data);
  }

  _c3tiles: C3TilesManager;
  _mvts: MVT[] = [];

  addLayer(l: LayerDescription) {
    switch (l.type) {
      case "3dtiles":
        this._c3tiles.add(l.url, this._c3tiles.length() == 0);
        this._c3tiles.update();
        break;
      case "mvt": {
        const mvt = new MVT({
          layers: l.layers ?? [],
          ...l,
        });
        this.scene.add(mvt.node);
        this._mvts.push(mvt);
        break;
      }
      case "tiles":
        this._core?.addLayer(l);
        break;
    }
  }

  _emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>) {
    this._events[event]?.forEach(c => (c as (...args: any[]) => any)(...args));
  }

  _startMainLoop() {
    const loop = () => {
      if (this._disposed) return;
      this._stats?.begin();

      if (this.update()) this.render();

      this._stats?.end();
      if (!this._disposed) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  _getCanvasSize(): { width: number; height: number } | undefined {
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

  _resize = () => {
    const { width, height } = this._getCanvasSize() ?? {};
    if (!width || !height) return;

    const pixelRatio = isWorker() ? undefined : window.devicePixelRatio;
    this.resize(width, height, pixelRatio);
  };
}

function newId() {
  return Math.random().toString(36).slice(2);
}
