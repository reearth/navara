import {
  WebGLRenderer,
  WebGLRenderTarget,
  PerspectiveCamera,
  Sprite,
  Group,
  Object3D,
  Mesh,
  Material,
  AlwaysStencilFunc,
  BackSide,
  DecrementWrapStencilOp,
  FrontSide,
  IncrementWrapStencilOp,
  KeepStencilOp,
  NotEqualStencilFunc,
  ZeroStencilOp,
} from "three";
import type { Scenes } from "./scene";
import type { MeshCache } from "./type";

export class PickHelper {
  private element: HTMLElement;
  private pickingTexture: WebGLRenderTarget;
  private pixelBuffer: Uint8Array;
  private renderer: WebGLRenderer;
  private camera: PerspectiveCamera;
  private scenes: Scenes;
  private meshes: MeshCache;
  private drapedFeatureMaterials: Map<string, Material>;
  private globeGBufferRenderTarget: WebGLRenderTarget;
  private highlightColor: number[];
  private onPickCallback: (pickArr: number[]) => void;

  mouseclickHandler: (event: MouseEvent) => void;

  constructor(
    element: HTMLElement,
    renderer: WebGLRenderer,
    camera: PerspectiveCamera,
    scenes: Scenes,
    meshes: MeshCache,
    drapedFeatureMaterials: Map<string, Material>,
    globeGBufferRenderTarget: WebGLRenderTarget,
    highlightColor: number[] | null | undefined,
    onPickCallback: (pickArr: number[]) => void,
  ) {
    this.element = element;
    this.pickingTexture = new WebGLRenderTarget(1, 1);
    this.pixelBuffer = new Uint8Array(4);
    this.renderer = renderer;
    this.camera = camera;
    this.scenes = scenes;
    this.meshes = meshes;
    this.drapedFeatureMaterials = drapedFeatureMaterials;
    this.globeGBufferRenderTarget = globeGBufferRenderTarget;
    this.highlightColor = highlightColor ?? [0, 1, 1];
    this.onPickCallback = onPickCallback;

    this.mouseclickHandler = (event: MouseEvent) => this.onMouseClick(event);
    element.addEventListener("click", this.mouseclickHandler);
  }

  private traverseModel(obj: Object3D, callfunc: (mesh: Mesh) => void) {
    if (obj instanceof Mesh) {
      callfunc(obj);
    }

    if (Array.isArray(obj.children) && obj.children.length > 0) {
      obj.children.forEach((child) => {
        this.traverseModel(child, callfunc);
      });
    }
  }

  private togglePickable(picable: number) {
    for (const [_key, obj] of this.meshes) {
      // point, billboard
      if (obj instanceof Sprite) {
        obj.material.userData.uPickable.value = picable;
        obj.frustumCulled = picable < 0.5;
      }

      // polygon, polyline
      if (obj instanceof Mesh && "uPickable" in obj.material.userData) {
        obj.material.userData.uPickable.value = picable;
      }

      // model
      if (obj instanceof Group) {
        this.traverseModel(obj, (mesh: Mesh) => {
          if ("userData" in mesh.material) {
            mesh.material.userData.uPickable.value = picable;
          }
        });
      }
    }
  }

  private renderDrapedMesh() {
    if (this.drapedFeatureMaterials.size !== 0) {
      const drapedFeaturesScene = this.scenes.drapedFeatures;

      this.drapedFeatureMaterials.forEach((m, k) => {
        // Back face
        m.stencilFunc = AlwaysStencilFunc;
        m.stencilFail = KeepStencilOp;
        m.stencilZPass = KeepStencilOp;
        m.stencilZFail = IncrementWrapStencilOp;
        m.side = BackSide;
        m.colorWrite = false;
        m.depthWrite = false;
        m.stencilWrite = true;
        m.depthTest = true;

        const mesh = this.meshes.get(k);
        if (!mesh) return;

        drapedFeaturesScene.add(mesh);
        this.renderer.render(drapedFeaturesScene, this.camera);

        // Front face
        m.side = FrontSide;
        m.stencilZFail = DecrementWrapStencilOp;
        this.renderer.render(drapedFeaturesScene, this.camera);

        // Final
        m.stencilFunc = NotEqualStencilFunc;
        m.stencilFail = ZeroStencilOp;
        m.stencilZFail = ZeroStencilOp;
        m.stencilZPass = ZeroStencilOp;
        m.side = BackSide;
        m.colorWrite = true;
        m.depthTest = false;
        this.renderer.render(drapedFeaturesScene, this.camera);

        drapedFeaturesScene.remove(mesh);

        // Reset
        m.colorWrite = false;
        m.depthWrite = false;
        m.depthTest = false;
        m.stencilWrite = false;
      });
    }
  }

  private pickSprite(pickArr: number[], obj: Sprite) {
    const batchId = obj.userData.batchId;
    let isPicked = false;
    for (let i = 0; i < pickArr.length; i++) {
      if (pickArr[i] === batchId) {
        isPicked = true;
        pickArr.splice(i, 1);
        break;
      }
    }

    if (obj.userData.isPicked !== isPicked) {
      obj.userData.isPicked = isPicked;
      if (isPicked) {
        obj.material.color.setRGB(
          this.highlightColor[0],
          this.highlightColor[1],
          this.highlightColor[2],
        );
      } else {
        obj.material.color.setHex(obj.userData.orgColor);
      }
    }
  }

  private pickModel(pickArr: number[], obj: Group) {
    const globalBatchIds = obj.userData.batchId;
    if (!globalBatchIds || globalBatchIds.length < 1) {
      return;
    }

    this.traverseModel(obj, (mesh: Mesh) => {
      const isPicked = mesh.geometry.attributes?.isPicked?.array;
      if (isPicked) {
        isPicked.fill(0);
        mesh.geometry.attributes.isPicked.needsUpdate = true;
      }
    });

    for (let i = 0; i < pickArr.length; ) {
      let bFound = false;

      this.traverseModel(obj, (mesh: Mesh) => {
        const internalBatchIds = mesh.geometry.attributes?._batchid?.array;
        const isPicked = mesh.geometry.attributes?.isPicked?.array;
        if (isPicked) {
          if (internalBatchIds) {
            for (let j = 0; j < internalBatchIds.length; j++) {
              if (globalBatchIds[internalBatchIds[j]] === pickArr[i]) {
                isPicked[j] = 1;
                bFound = true;
              }
            }
          } else {
            if (globalBatchIds[0] === pickArr[i]) {
              isPicked.fill(1);
              bFound = true;
            }
          }
          mesh.geometry.attributes.isPicked.needsUpdate = true;
        }
      });

      if (bFound) {
        pickArr.splice(i, 1);
      } else {
        i++;
      }
    }
  }

  private pickMesh(pickArr: number[], obj: Mesh) {
    const batchId = obj.userData.batchId;
    const isPicked = obj.geometry.attributes.isPicked.array;
    isPicked.fill(0);

    for (let i = 0; i < pickArr.length; ) {
      let bFound = false;
      for (let j = 0; j < batchId.length; j++) {
        if (batchId[j] === pickArr[i]) {
          isPicked[j] = 1;
          bFound = true;
        }
      }

      if (bFound) {
        pickArr.splice(i, 1);
      } else {
        i++;
      }
    }
    obj.geometry.attributes.isPicked.needsUpdate = true;
  }

  private toggleHighlight(pickArr: number[]) {
    const pickarr = pickArr.slice();
    for (const [_key, obj] of this.meshes) {
      // point, billboard
      if (obj instanceof Sprite) {
        this.pickSprite(pickarr, obj);
      }

      // model
      if (obj instanceof Group && obj.userData.batchId) {
        this.pickModel(pickarr, obj);
      }

      // polygon, polyline
      if (obj instanceof Mesh && obj.userData.batchId) {
        this.pickMesh(pickarr, obj);
      }
    }
  }

  public renderDebug() {
    this.togglePickable(1);

    this.renderer.setRenderTarget(this.globeGBufferRenderTarget);
    this.renderer.clear();
    this.renderer.render(this.scenes.globeGBuffer, this.camera);

    this.renderer.setRenderTarget(null);
    this.renderer.clear();
    this.renderer.render(this.scenes.globe, this.camera);

    this.renderDrapedMesh();
    this.renderer.render(this.scenes.main, this.camera);

    this.togglePickable(0);
  }

  private onMouseClick(event: MouseEvent) {
    const x = event.clientX;
    const y = event.clientY;

    const pixelRatio = this.renderer.getPixelRatio();
    this.camera.setViewOffset(
      this.renderer.getContext().drawingBufferWidth, // full width
      this.renderer.getContext().drawingBufferHeight, // full top
      (x * pixelRatio) | 0, // rect x
      (y * pixelRatio) | 0, // rect y
      1, // rect width
      1, // rect height
    );

    this.togglePickable(1);

    this.renderer.setRenderTarget(this.globeGBufferRenderTarget);
    this.renderer.clear();
    this.renderer.render(this.scenes.globeGBuffer, this.camera);

    this.renderer.setRenderTarget(this.pickingTexture);
    this.renderer.clear();
    this.renderer.render(this.scenes.globe, this.camera);

    this.renderDrapedMesh();
    this.renderer.render(this.scenes.main, this.camera);

    this.togglePickable(0);

    this.renderer.readRenderTargetPixels(
      this.pickingTexture,
      0, // x
      0, // y
      1, // width
      1, // height
      this.pixelBuffer,
    );

    this.renderer.setRenderTarget(null);
    this.camera.clearViewOffset();

    const batchId =
      (this.pixelBuffer[0] << 16) +
      (this.pixelBuffer[1] << 8) +
      this.pixelBuffer[2];

    const pickArr = batchId > 0 ? [batchId] : [];
    this.toggleHighlight(pickArr);
    this.onPickCallback(pickArr);
  }

  public dispose() {
    this.element.removeEventListener("click", this.mouseclickHandler);
  }
}
