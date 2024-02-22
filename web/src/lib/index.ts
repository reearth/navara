import initCore, { Core } from "map-engine-prototype";
import Stats from "stats.js";
import { PerspectiveCamera, Scene, WebGLRenderer, type Renderer } from "three";

import { processEvent } from "./event";
import { initScene } from "./example";
import { registerInputEvents } from "./input";
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
  renderer?: Renderer;
};

export type Events = {
  resize: () => void;
};

export default class ThreeView {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: Renderer;

  _core: Core | undefined;
  _options: Options;
  _stats: Stats | undefined;
  _eventDisposer: (() => void) | undefined;
  _disposed = false;
  _events: {
    [K in keyof Events]?: Events[K][];
  } = {};

  constructor(options: Options) {
    if (!options.container && !options.canvas && !options.renderer) {
      throw new Error("Must provide either target, canvas, or renderer");
    }

    this._options = options;

    if (options.renderer) {
      this.renderer = options.renderer;
    } else {
      const renderer = new WebGLRenderer({
        antialias: true,
        // alpha: true,
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
      initScene(scene);
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

  resize = (width: number, height: number, pixelRatio?: number) => {
    if (this._disposed) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, !isWorker());
    if (
      typeof pixelRatio === "number" &&
      "setPixelRatio" in this.renderer &&
      typeof this.renderer.setPixelRatio === "function"
    ) {
      this.renderer.setPixelRatio(pixelRatio);
    }

    this._emit("resize");
  };

  /** Returns true if the scene was updated and needs to be rendered. */
  update(): boolean {
    this._core?.update();

    const events = this._core?.readEvents();
    if (events) {
      processEvent(this.scene, this.camera, events);
    }

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
