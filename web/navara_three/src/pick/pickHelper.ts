import {
  WebGLRenderer,
  WebGLRenderTarget,
  PerspectiveCamera,
  Object3D,
  Mesh,
  Material,
  Scene,
  RGBAFormat,
  Color,
} from "three";

import { BufferView } from "../bufferView";
import {
  TextMesh,
  ModelMesh,
  InstancedMesh,
  TileMesh,
  BatchedFeatureMesh,
} from "../mesh";
import { CustomRenderPass } from "../passes";
import type { Scenes } from "../scene";
import type { MeshCache } from "../type";

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
    highlightColor: Color,
    onPickCallback: (pickArr: number[]) => number[],
    inputBuffer: WebGLRenderTarget,
    options?: PickHelperOptions,
  ) {
    super(scenes, camera, meshes, drapedFeatureMaterials, inputBuffer);

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

  private togglePickable(pickable: number) {
    for (const [_key, obj] of this._meshes) {
      // point, billboard, text
      if (obj instanceof InstancedMesh) {
        obj.setPickable(pickable);
      }
      // polygon, polyline
      else if (obj instanceof BatchedFeatureMesh) {
        obj._togglePickable(pickable);
      }

      // model
      else if (obj instanceof ModelMesh) {
        this.traverseModel(obj, (mesh: Mesh) => {
          if ("userData" in mesh.material && mesh.material.userData.uPickable) {
            mesh.material.userData.uPickable.value = pickable;
          }
        });
      }
      // text
      else if (obj instanceof TextMesh) {
        obj.userData.uPickable.value = pickable;

        obj.children.forEach((item) => {
          // The frustum used for picking is only 1 pixel in size,
          // and both the text and its background dynamically change positions,
          // they risk being incorrectly culled. Therefore, frustumCulled must be set to false
          item.frustumCulled = pickable < 0.5;
        });
      }
      // tile
      else if (obj instanceof TileMesh) {
        obj._togglePickable(pickable);
      }
    }

    // Since SkyMesh renders fullscreen quad plane, and it shows just black, this scene should be invisible.
    // We should support picking in this scene in the future.
    this._scenes.opaque.visible = !pickable;
  }

  private pickSprite(pickSet: Set<number>, obj: InstancedMesh<Object3D>) {
    obj.pick(pickSet, this.highlightColor);
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

  private toggleHighlight(pickArr: number[]) {
    const pickSet = new Set(pickArr);
    for (const [_key, obj] of this._meshes) {
      // point, billboard
      if (obj instanceof InstancedMesh) {
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
    }
  }

  public processRender(target: WebGLRenderTarget) {
    const orgClearColor = new Color();
    this._renderer.getClearColor(orgClearColor);

    this._renderer.setClearColor(0x000000);

    this.togglePickable(1);

    this.render(this._renderer, target, null);

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
