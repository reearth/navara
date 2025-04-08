import {
  WebGLRenderer,
  WebGLRenderTarget,
  PerspectiveCamera,
  Sprite,
  Group,
  Object3D,
  Mesh,
  Material,
  Scene,
  RGBAFormat,
  Color,
} from "three";
import { Text } from "troika-three-text";

import { BufferView } from "./bufferView";
import { TextMesh, ModelMesh } from "./mesh";
import { CustomRenderPass } from "./renderPass";
import type { Scenes } from "./scene";
import type { MeshCache } from "./type";

export type PickHelperOptions = {
  debug: boolean;
};

export class PickHelper extends CustomRenderPass {
  private element: HTMLElement;
  private pickingTexture: WebGLRenderTarget;
  private pixelBuffer: Uint8Array;
  private _renderer: WebGLRenderer;
  private highlightColor: Color;
  private onPickCallback: (pickArr: number[]) => number[];

  private debugBufferView?: BufferView;
  private debugRenderTarget?: WebGLRenderTarget;

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
    options?: PickHelperOptions,
  ) {
    super(
      scenes,
      camera,
      meshes,
      globeGBufferRenderTarget,
      drapedFeatureMaterials,
    );

    this.element = element;
    this.pickingTexture = new WebGLRenderTarget(1, 1, {
      format: RGBAFormat,
      depthBuffer: true,
      stencilBuffer: true,
    });
    this.pixelBuffer = new Uint8Array(4);
    this._renderer = renderer;
    this.camera = camera;
    this.highlightColor = highlightColor;
    this.onPickCallback = onPickCallback;

    this.mouseMoved = false;
    this.mouseDownHandler = (event: MouseEvent) => this.onMouseDown(event);
    this.mouseMoveHandler = (event: MouseEvent) => this.onMouseMove(event);
    this.mouseUpHandler = (event: MouseEvent) => this.onMouseUp(event);

    if (options?.debug) {
      const width = this._renderer.getContext().drawingBufferWidth;
      const height = this._renderer.getContext().drawingBufferHeight;
      this.debugBufferView = new BufferView(width, height);
      this.debugRenderTarget = new WebGLRenderTarget(width, height, {
        format: RGBAFormat,
        depthBuffer: true,
        stencilBuffer: true,
      });
    }
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
    for (const [_key, obj] of this._meshes) {
      // point, billboard
      if (obj instanceof Sprite) {
        obj.material.userData.uPickable.value = picable;

        // The frustum used for picking is only 1 pixel in size,
        // For sprites, the bounding box used for frustum culling can be inaccurately determined.
        obj.frustumCulled = picable < 0.5;
      }

      // polygon, polyline
      else if (obj instanceof Mesh && "uPickable" in obj.material.userData) {
        obj.material.userData.uPickable.value = picable;
      }

      // model
      else if (obj instanceof ModelMesh) {
        this.traverseModel(obj, (mesh: Mesh) => {
          if ("userData" in mesh.material && mesh.material.userData.uPickable) {
            mesh.material.userData.uPickable.value = picable;
          }
        });
      }
      // text
      else if (obj instanceof TextMesh) {
        obj.userData.uPickable.value = picable;

        obj.children.forEach((item) => {
          // The frustum used for picking is only 1 pixel in size,
          // and both the text and its background dynamically change positions,
          // they risk being incorrectly culled. Therefore, frustumCulled must be set to false
          item.frustumCulled = picable < 0.5;
        });
      }
      // tile
      else if (obj instanceof Mesh && "tileOrigColor" in obj.userData) {
        if (picable) {
          obj.material.color.setHex(0);
        } else {
          obj.material.color.setHex(obj.userData.tileOrigColor);
        }
      }
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
        obj.userData.orgColor = obj.material.color.clone();
        obj.material.color.set(this.highlightColor);
      } else {
        obj.material.color.set(obj.userData.orgColor);
      }
    }
  }

  private pickModel(pickSet: Set<number>, obj: ModelMesh) {
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

  private pickText(pickSet: Set<number>, obj: Group) {
    const batchId = obj.userData.batchId;
    const isPicked = pickSet.has(batchId);
    if (isPicked) {
      pickSet.delete(batchId);
    }

    if (obj.userData.isPicked !== isPicked) {
      obj.userData.isPicked = isPicked;

      const txt = obj.children.find((item) => item instanceof Text) as Text;
      if (isPicked) {
        obj.userData.orgColor =
          txt.color instanceof Color ? txt.color.clone() : txt.color;
        txt.color = this.highlightColor;
      } else {
        txt.color = obj.userData.orgColor ?? txt.color;
      }
    }
  }

  private toggleHighlight(pickArr: number[]) {
    const pickSet = new Set(pickArr);
    for (const [_key, obj] of this._meshes) {
      // point, billboard
      if (obj instanceof Sprite) {
        this.pickSprite(pickSet, obj);
      }

      // model
      else if (obj instanceof ModelMesh) {
        this.pickModel(pickSet, obj);
      }

      // polygon, polyline
      else if (obj instanceof Mesh && obj.userData.batchIdAndSel) {
        this.pickMesh(pickSet, obj);
      }

      // text
      else if (obj instanceof TextMesh) {
        this.pickText(pickSet, obj);
      }
    }
  }

  public processRender(target: WebGLRenderTarget) {
    const orgClearColor = new Color();
    this._renderer.getClearColor(orgClearColor);

    this._renderer.setClearColor(0x000000);

    this.togglePickable(1);

    this._renderer.setRenderTarget(this._globeGBufferRenderTarget);
    this._renderer.clear();
    this._renderer.render(this._scenes.globeGBuffer, this.camera);

    this._renderer.setRenderTarget(target);
    this._renderer.clear();
    this._renderer.render(this._scenes.globe, this.camera);

    this._renderDrapedMesh(this._renderer);
    this._renderer.render(this._scenes.main, this.camera);

    this.togglePickable(0);

    this._renderer.setClearColor(orgClearColor);
  }

  protected _renderWithWorld(renderer: WebGLRenderer, scene: Scene) {
    renderer.render(scene, this._camera);
  }

  public renderDebugCanvas() {
    if (!this.debugBufferView || !this.debugRenderTarget) return;

    this.processRender(this.debugRenderTarget);

    this.debugBufferView.render(this._renderer, this.debugRenderTarget);
  }

  private onMouseClick(event: MouseEvent) {
    const x = event.clientX;
    const y = event.clientY;

    const pixelRatio = this._renderer.getPixelRatio();
    this._camera.setViewOffset(
      this._renderer.getContext().drawingBufferWidth, // full width
      this._renderer.getContext().drawingBufferHeight, // full top
      (x * pixelRatio) | 0, // rect x
      (y * pixelRatio) | 0, // rect y
      1, // rect width
      1, // rect height
    );

    this.processRender(this.pickingTexture);

    this._renderer.readRenderTargetPixels(
      this.pickingTexture,
      0, // x
      0, // y
      1, // width
      1, // height
      this.pixelBuffer,
    );

    this._renderer.setRenderTarget(null);
    this._camera.clearViewOffset();

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
