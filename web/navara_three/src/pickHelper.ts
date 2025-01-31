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
  private highlightColor: number;
  private onPickCallback: (pickArr: number[]) => void;

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
    highlightColor: number,
    onPickCallback: (pickArr: number[]) => void,
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
        obj.material.color.setHex(this.highlightColor);
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
      if ("userData" in mesh.material) {
        mesh.material.userData.uHighlightColor.value = new Color(
          this.highlightColor,
        );
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

    if ("userData" in obj.material) {
      obj.material.userData.uHighlightColor.value = new Color(
        this.highlightColor,
      );
    }

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
    this.toggleHighlight(pickArr);
    this.onPickCallback(pickArr);
  }

  public dispose() {
    this.enablePick(false);
  }
}
