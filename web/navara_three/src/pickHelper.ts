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
  RGBAFormat,
  Color,
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
  private highlightColor: Color;
  private onPickCallback: (pickArr: number[]) => number[];

  private mouseMoved: boolean;
  private mouseDownHandler: (event: MouseEvent) => void;
  private mouseMoveHandler: (event: MouseEvent) => void;
  private mouseUpHandler: (event: MouseEvent) => void;

  constructor(
    element: HTMLElement,
    renderer: WebGLRenderer,
    camera: PerspectiveCamera,
    scenes: Scenes,
    meshes: MeshCache,
    drapedFeatureMaterials: Map<string, Material>,
    globeGBufferRenderTarget: WebGLRenderTarget,
    highlightColor: Color,
    onPickCallback: (pickArr: number[]) => number[],
  ) {
    this.element = element;
    this.pickingTexture = new WebGLRenderTarget(1, 1, {
      format: RGBAFormat,
      depthBuffer: true,
      stencilBuffer: true,
    });
    this.pixelBuffer = new Uint8Array(4);
    this.renderer = renderer;
    this.camera = camera;
    this.scenes = scenes;
    this.meshes = meshes;
    this.drapedFeatureMaterials = drapedFeatureMaterials;
    this.globeGBufferRenderTarget = globeGBufferRenderTarget;
    this.highlightColor = highlightColor;
    this.onPickCallback = onPickCallback;

    this.mouseMoved = false;
    this.mouseDownHandler = (event: MouseEvent) => this.onMouseDown(event);
    this.mouseMoveHandler = (event: MouseEvent) => this.onMouseMove(event);
    this.mouseUpHandler = (event: MouseEvent) => this.onMouseUp(event);

    // element.addEventListener("dblclick", this.renderDebugFile.bind(this));
  }

  private onMouseDown(_event: MouseEvent) {
    this.mouseMoved = false;
  }

  private onMouseMove(_event: MouseEvent) {
    this.mouseMoved = true;
  }

  private onMouseUp(event: MouseEvent) {
    if (!this.mouseMoved) {
      this.onMouseClick(event);
    }
  }

  enablePick(bPick: boolean) {
    if (bPick) {
      this.element.addEventListener("mousedown", this.mouseDownHandler);
      this.element.addEventListener("mousemove", this.mouseMoveHandler);
      this.element.addEventListener("mouseup", this.mouseUpHandler);
    } else {
      this.element.removeEventListener("mousedown", this.mouseDownHandler);
      this.element.removeEventListener("mousemove", this.mouseMoveHandler);
      this.element.removeEventListener("mouseup", this.mouseUpHandler);
    }
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

  // TODO: Commonize this function with `renderPass.ts`, this class should be extended by `CustomRenderPass`.
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

  private pickSprite(pickSet: Set<number>, obj: Sprite) {
    const batchId = obj.userData.batchId;
    const isPicked = pickSet.has(batchId);
    if (isPicked) {
      pickSet.delete(batchId);
    }

    if (obj.userData.isPicked !== isPicked) {
      obj.userData.isPicked = isPicked;
      if (isPicked) {
        obj.material.color.set(this.highlightColor);
      } else {
        obj.material.color.setHex(obj.userData.orgColor);
      }
    }
  }

  private pickModel(pickSet: Set<number>, obj: Group) {
    const batchIdAndSel = obj.userData.batchIdAndSel;
    const dataSize = obj.userData.dataSize;
    if (!batchIdAndSel || batchIdAndSel.length < 1 || !dataSize) {
      return;
    }

    this.traverseModel(obj, (mesh: Mesh) => {
      const attrBatchIdAndSel = mesh.geometry.attributes?.batchIdAndSel?.array;
      if (attrBatchIdAndSel) {
        for (let i = 1; i < attrBatchIdAndSel.length; i += 2) {
          attrBatchIdAndSel[i] = 0;
        }
        mesh.geometry.attributes.batchIdAndSel.needsUpdate = true;
      }
    });

    const toDelete = new Set<number>();

    this.traverseModel(obj, (mesh: Mesh) => {
      const internalBatchIds = mesh.geometry.attributes?._batchid?.array;
      const attrBatchIdAndSel = mesh.geometry.attributes?.batchIdAndSel?.array;
      if (attrBatchIdAndSel) {
        if (internalBatchIds) {
          for (let j = 0; j < internalBatchIds.length; j++) {
            const batchId = batchIdAndSel[internalBatchIds[j] * dataSize];
            if (pickSet.has(batchId)) {
              attrBatchIdAndSel[j * 2 + 1] = 1;
              toDelete.add(batchId);
            }
          }
        } else {
          if (pickSet.has(batchIdAndSel[0])) {
            for (let i = 1; i < attrBatchIdAndSel.length; i += 2) {
              attrBatchIdAndSel[i] = 1;
            }
            toDelete.add(batchIdAndSel[0]);
          }
        }
        mesh.geometry.attributes.batchIdAndSel.needsUpdate = true;
      }
    });

    toDelete.forEach((batchId) => pickSet.delete(batchId));
  }

  private pickMesh(pickSet: Set<number>, obj: Mesh) {
    const batchIdAndSel = obj.userData.batchIdAndSel;
    const attrBatchIdAndSel = obj.geometry.attributes?.batchIdAndSel?.array;
    if (!attrBatchIdAndSel) {
      return;
    }

    for (let i = 1; i < attrBatchIdAndSel.length; i += 2) {
      attrBatchIdAndSel[i] = 0;
    }

    const toDelete = new Set<number>();

    for (let j = 0; j < batchIdAndSel.length; j += 2) {
      if (pickSet.has(batchIdAndSel[j])) {
        attrBatchIdAndSel[j + 1] = 1;
        toDelete.add(batchIdAndSel[j]);
      }
    }

    toDelete.forEach((batchId) => pickSet.delete(batchId));
    obj.geometry.attributes.batchIdAndSel.needsUpdate = true;
  }

  private toggleHighlight(pickArr: number[]) {
    const pickSet = new Set(pickArr);
    for (const [_key, obj] of this.meshes) {
      // point, billboard
      if (obj instanceof Sprite) {
        this.pickSprite(pickSet, obj);
      }

      // model
      else if (obj instanceof Group && obj.userData.batchIdAndSel) {
        this.pickModel(pickSet, obj);
      }

      // polygon, polyline
      else if (obj instanceof Mesh && obj.userData.batchIdAndSel) {
        this.pickMesh(pickSet, obj);
      }
    }
  }

  public renderDebugScreen() {
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

  public renderDebugFile() {
    const width = this.renderer.getContext().drawingBufferWidth;
    const height = this.renderer.getContext().drawingBufferHeight;

    const renderTarget = new WebGLRenderTarget(width, height, {
      format: RGBAFormat,
      depthBuffer: true,
      stencilBuffer: true,
    });

    this.camera.setViewOffset(width, height, 0, 0, width, height);

    this.togglePickable(1);

    this.renderer.setRenderTarget(this.globeGBufferRenderTarget);
    this.renderer.clear();
    this.renderer.render(this.scenes.globeGBuffer, this.camera);

    this.renderer.setRenderTarget(renderTarget);
    this.renderer.clear();
    this.renderer.render(this.scenes.globe, this.camera);

    this.renderDrapedMesh();
    this.renderer.render(this.scenes.main, this.camera);

    this.togglePickable(0);

    const pixelBuffer = new Uint8Array(width * height * 4);
    this.renderer.readRenderTargetPixels(
      renderTarget,
      0,
      0,
      width,
      height,
      pixelBuffer,
    );

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.createImageData(width, height);
    imageData.data.set(pixelBuffer);

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;
    tempCtx.putImageData(imageData, 0, 0);

    ctx.translate(0, canvas.height);
    ctx.scale(1, -1);
    ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);

    const dataURL = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataURL;
    link.download = "render.png";
    link.click();

    renderTarget.dispose();
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
    const pickedBatchIds = this.onPickCallback(pickArr);
    if (pickedBatchIds) {
      this.toggleHighlight(pickedBatchIds);
    }
  }

  public dispose() {
    this.enablePick(false);
  }
}
