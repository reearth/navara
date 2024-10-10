import { TilesRenderer, GLTFCesiumRTCExtension } from "3d-tiles-renderer";
import {
  Box3,
  BoxGeometry,
  Camera,
  EventDispatcher,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { DRACOLoader, GLTFLoader, type GLTFLoaderPlugin } from "three-stdlib";

export type LoadEvent = {
  type: "load";
  center: Vector3;
};

export class C3Tiles extends EventDispatcher<{ load: LoadEvent }> {
  tilesRenderer: TilesRenderer;
  center: Vector3 | undefined;
  url: string;

  constructor(scene: Scene, camera: Camera, renderer: WebGLRenderer, url: string) {
    super();

    this.url = url;

    const tilesRenderer = new TilesRenderer(url);
    this.tilesRenderer = tilesRenderer;

    const tilesetGroup = new Group();

    const dracoLoader = new DRACOLoader(tilesRenderer.manager);
    dracoLoader.setDecoderPath("https://unpkg.com/three@0.161.0/examples/jsm/libs/draco/gltf/");
    const gltfLoader = new GLTFLoader(tilesRenderer.manager);

    gltfLoader.register(() => new GLTFCesiumRTCExtension() as GLTFLoaderPlugin);
    gltfLoader.setDRACOLoader(dracoLoader);
    tilesRenderer.manager.addHandler(/\.gltf$/, gltfLoader);
    tilesRenderer.manager.addHandler(/\.glb$/, gltfLoader);

    tilesRenderer.setCamera(camera);
    tilesRenderer.setResolutionFromRenderer(camera, renderer);
    tilesetGroup.add(tilesRenderer.group);
    scene.add(tilesetGroup);

    tilesRenderer.addEventListener("load-tile-set", titleset => {
      console.log("load tileset", titleset);

      const box = new Box3();
      const matrix = new Matrix4();
      tilesRenderer.getOrientedBoundingBox(box, matrix);

      const obb = box.clone();
      obb.applyMatrix4(matrix);
      const center = new Vector3();
      obb.getCenter(center);
      this.center = center;

      // obb
      const obbGeometry = new BoxGeometry(
        box.min.x - box.max.x,
        box.min.y - box.max.y,
        box.min.z - box.max.z,
      );
      obbGeometry.applyMatrix4(matrix);
      const obbMaterial = new MeshBasicMaterial({ color: 0xff0000, wireframe: true });
      const obbMesh = new Mesh(obbGeometry, obbMaterial);
      obbMesh.position.copy(center);
      tilesetGroup.add(obbMesh);

      this.dispatchEvent({ type: "load", center });
    });
  }

  update() {
    this.tilesRenderer.update();
  }

  dispose() {
    this.tilesRenderer.dispose();
  }
}

export type Control = {
  update: () => void;
  get target(): Vector3 | undefined;
};

export class C3TilesManager {
  layers: C3Tiles[] = [];
  scene: Scene;
  camera: Camera;
  renderer: WebGLRenderer;
  control?: Control;

  constructor(scene: Scene, camera: Camera, renderer: WebGLRenderer, control?: Control) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.control = control;
  }

  update() {
    for (const layer of this.layers) {
      layer.update();
    }
  }

  add(url: string, autoCameraFlyTo = true) {
    const layer = new C3Tiles(this.scene, this.camera, this.renderer, url);
    if (autoCameraFlyTo) {
      layer.addEventListener("load", e => {
        this.control?.target?.copy(e.center);
        this.camera.position.copy(e.center);
        this.camera.position.addScalar(50);
        this.camera.up.copy(e.center).normalize();
        this.camera.lookAt(e.center);
        this.control?.update();
      });
    }
    this.layers.push(layer);
    return layer;
  }

  remove(url: string) {
    const index = this.layers.findIndex(layer => layer.url === url);
    if (index !== -1) {
      const layer = this.layers[index];
      this.layers.splice(index, 1);
      layer.dispose();
    }
  }

  dispose() {
    for (const layer of this.layers) {
      layer.dispose();
    }
  }

  length() {
    return this.layers.length;
  }
}
