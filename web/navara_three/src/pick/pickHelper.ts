import {
  WebGLRenderer,
  WebGLRenderTarget,
  PerspectiveCamera,
  Object3D,
  RGBAFormat,
  Color,
  Scene,
  Vector2,
} from "three";

import { BufferView } from "../bufferView";
import { isPickableMesh, type PickableMesh } from "../mesh/pickableMesh";
import { TileScene } from "../scene";
import type { MeshCache } from "../type";

export type PickHelperOptions = {
  debug: boolean;
};

/**
 * Travel tolerance in CSS pixels between mousedown and mouseup to count as a click.
 * Follows Cesium's `_clickPixelTolerance` (MapLibre uses 3px).
 * ref: https://github.com/CesiumGS/cesium/blob/9fda7ab97a762e40c74b1d0e1814c98a2de43337/packages/engine/Source/Core/ScreenSpaceEventHandler.js#L1012
 * ref: https://github.com/maplibre/maplibre-gl-js/blob/3a0a4f795fef5b2a29034d71833475589c344eaf/src/ui/map.ts#L542
 */
const CLICK_PIXEL_TOLERANCE = 5;

export function isClickGesture(
  downPosition: Vector2,
  upPosition: Vector2,
): boolean {
  return downPosition.distanceTo(upPosition) < CLICK_PIXEL_TOLERANCE;
}

/**
 * GPU picking using a dedicated single-pixel render pass.
 *
 * The pick pass does NOT reuse the main render pipeline (globe / MRT /
 * draped / copy passes). Instead, every pickable raw — regardless of
 * which pass scene (opaque, mrt, ...) it normally lives in — is
 * temporarily re-parented into a dedicated `pickScene` for the render
 * and then restored to its original parent afterwards. This guarantees
 * the pick buffer contains exactly the pickable content and nothing
 * else can leak in (globe tiles, outlines, draped features, sky, etc.).
 *
 * Re-parenting is safe because pass scenes all have identity world
 * transforms, so world matrices of the re-parented objects are
 * unaffected.
 *
 * Two gestures trigger a pick: a click (mousedown/mouseup within
 * {@link CLICK_PIXEL_TOLERANCE}) and hovering, throttled to at most one
 * pick per animation frame. Both are lazy: a pick runs only while the
 * matching `shouldClickPick` / `shouldHoverPick` gate returns true
 * (i.e. someone is listening for the result).
 */
export class PickHelper {
  private element: HTMLElement;
  private pixelBuffer: Uint8Array;
  private _renderer: WebGLRenderer;
  private _camera: PerspectiveCamera;
  private _meshes: MeshCache;
  private onPickCallback: (pickArr: number[]) => void;

  /** Dedicated scene used only during the pick render. */
  private readonly pickScene = new Scene();

  private debugBufferView?: BufferView;
  private debugRenderTarget?: WebGLRenderTarget;
  /** Full-size render target used for click picking with scissor restriction. */
  private pickRenderTarget: WebGLRenderTarget;

  private onHoverCallback: (pickArr: number[]) => void;
  /** Click picks run only while this returns true (e.g. featureClick listeners exist). */
  private shouldClickPick: () => boolean;
  /** Hover picks run only while this returns true (e.g. hover listeners exist). */
  private shouldHoverPick: () => boolean;

  private mouseDownPosition?: Vector2;
  private mouseDownHandler: (event: MouseEvent) => void;
  private mouseUpHandler: (event: MouseEvent) => void;
  private hoverMoveHandler: (event: MouseEvent) => void;
  private hoverLeaveHandler: () => void;
  /** Latest mousemove position awaiting a hover pick, in client coords. */
  private hoverPosition?: Vector2;
  private hoverRafId?: number;

  constructor(
    element: HTMLElement,
    renderer: WebGLRenderer,
    camera: PerspectiveCamera,
    meshes: MeshCache,
    onPickCallback: (pickArr: number[]) => void,
    onHoverCallback: (pickArr: number[]) => void,
    shouldClickPick: () => boolean,
    shouldHoverPick: () => boolean,
    options?: PickHelperOptions,
  ) {
    this.element = element;
    this.pixelBuffer = new Uint8Array(4);
    this._renderer = renderer;
    this._camera = camera;
    this._meshes = meshes;
    this.onPickCallback = onPickCallback;
    this.onHoverCallback = onHoverCallback;
    this.shouldClickPick = shouldClickPick;
    this.shouldHoverPick = shouldHoverPick;

    this.mouseDownHandler = (event: MouseEvent) => this.onMouseDown(event);
    this.mouseUpHandler = (event: MouseEvent) => this.onMouseUp(event);
    this.hoverMoveHandler = (event: MouseEvent) => this.onHoverMouseMove(event);
    this.hoverLeaveHandler = () => this.onHoverMouseLeave();

    const width = this._renderer.getContext().drawingBufferWidth;
    const height = this._renderer.getContext().drawingBufferHeight;

    this.pickRenderTarget = new WebGLRenderTarget(width, height, {
      format: RGBAFormat,
      depthBuffer: true,
      stencilBuffer: false,
    });

    if (options?.debug) {
      this.debugBufferView = new BufferView(width, height);
      this.debugRenderTarget = new WebGLRenderTarget(width, height, {
        format: RGBAFormat,
        depthBuffer: true,
        stencilBuffer: false,
      });
    }
  }

  private onMouseDown(event: MouseEvent) {
    this.mouseDownPosition = new Vector2(event.clientX, event.clientY);
  }

  private onMouseUp(event: MouseEvent) {
    const downPosition = this.mouseDownPosition;
    this.mouseDownPosition = undefined;
    if (!downPosition) return;

    // Skip the GPU pick entirely when nobody is listening for the result.
    if (!this.shouldClickPick()) return;

    if (
      isClickGesture(downPosition, new Vector2(event.clientX, event.clientY))
    ) {
      this.onMouseClick(event);
    }
  }

  enablePick(bPick: boolean) {
    if (bPick) {
      this.element.addEventListener("mousedown", this.mouseDownHandler);
      this.element.addEventListener("mouseup", this.mouseUpHandler);
      this.element.addEventListener("mousemove", this.hoverMoveHandler);
      this.element.addEventListener("mouseleave", this.hoverLeaveHandler);
    } else {
      this.element.removeEventListener("mousedown", this.mouseDownHandler);
      this.element.removeEventListener("mouseup", this.mouseUpHandler);
      this.element.removeEventListener("mousemove", this.hoverMoveHandler);
      this.element.removeEventListener("mouseleave", this.hoverLeaveHandler);
      this.cancelPendingHoverPick();
    }
  }

  /**
   * Hover picking: schedules at most one GPU pick per animation frame from
   * the latest mousemove position. Suppressed while any mouse button is
   * pressed (camera drags would otherwise trigger a pick per frame) and
   * while `shouldHoverPick` returns false, so pages without hover
   * listeners pay nothing.
   */
  private onHoverMouseMove(event: MouseEvent) {
    if (event.buttons !== 0 || !this.shouldHoverPick()) return;

    if (!this.hoverPosition) this.hoverPosition = new Vector2();
    this.hoverPosition.set(event.clientX, event.clientY);

    if (this.hoverRafId !== undefined) return;
    this.hoverRafId = requestAnimationFrame(() => {
      this.hoverRafId = undefined;
      const position = this.hoverPosition;
      if (!position) return;
      this.hoverPosition = undefined;

      const batchId = this.pickBatchIdAt(position.x, position.y);
      this.onHoverCallback(batchId > 0 ? [batchId] : []);
    });
  }

  private onHoverMouseLeave() {
    this.cancelPendingHoverPick();
    // Report "nothing hovered" so diff-based enter/leave synthesis can
    // close out the current hover when the cursor exits the canvas.
    if (this.shouldHoverPick()) {
      this.onHoverCallback([]);
    }
  }

  private cancelPendingHoverPick() {
    if (this.hoverRafId !== undefined) {
      cancelAnimationFrame(this.hoverRafId);
      this.hoverRafId = undefined;
    }
    this.hoverPosition = undefined;
  }

  /**
   * Moves every pickable raw (visible, currently parented) into the
   * dedicated `pickScene` and activates the picking uniforms on its
   * wrapper. Returns a teardown callback that restores original parents
   * and deactivates the uniforms.
   */
  private stagePickables(pickingCoord?: Vector2): () => void {
    const restoreParents: [Object3D, Object3D][] = [];
    const activated: PickableMesh[] = [];

    for (const [_key, obj] of this._meshes) {
      if (!isPickableMesh(obj)) continue;

      const raw = obj.getRenderable();
      const originalParent = raw.parent;

      // Only pick visible, currently-parented renderables. A mesh that's
      // hidden or detached isn't rendered in the main view, so picking
      // it would be surprising.
      if (!originalParent || !raw.visible) continue;

      obj.onBeforePicking(pickingCoord);
      activated.push(obj);

      // Draped vector-tile meshes live inside a TileScene and are picked
      // through their owning TileMesh's composite atlas — the per-layer RT
      // is re-rendered with pick mode active (the onBeforePicking above
      // flipped the mesh's own enhancer into pick mode) and the atlas then
      // carries the pick IDs into the main pick render. Reparenting them
      // here would (a) empty the TileScene so the per-layer RT renders
      // nothing and (b) make them draw at their un-draped 3D position in
      // pickScene, where they depth-fight with the terrain.
      if (originalParent instanceof TileScene) continue;

      // Scene.add auto-removes from the previous parent. Both parents
      // are pass scenes with identity world transforms, so the raw's
      // world matrix is unaffected.
      this.pickScene.add(raw);
      restoreParents.push([raw, originalParent]);
    }

    return () => {
      for (const [raw, parent] of restoreParents) parent.add(raw);
      for (const w of activated) w.onAfterPicking();
    };
  }

  /**
   * Dedicated picking render: clears the target to black (batchId=0) and
   * renders only the pickable raws, regardless of which pass scene they
   * normally live in.
   */
  public processRender(target: WebGLRenderTarget, pickingCoord?: Vector2) {
    const origClearColor = new Color();
    this._renderer.getClearColor(origClearColor);
    const origClearAlpha = this._renderer.getClearAlpha();
    const origRenderTarget = this._renderer.getRenderTarget();
    const origAutoClear = this._renderer.autoClear;

    const teardown = this.stagePickables(pickingCoord);

    this._renderer.setClearColor(0x000000, 1);
    this._renderer.setRenderTarget(target);
    this._renderer.autoClear = true;
    this._renderer.clear(true, true, false);
    this._renderer.render(this.pickScene, this._camera);

    teardown();

    this._renderer.setRenderTarget(origRenderTarget);
    this._renderer.setClearColor(origClearColor, origClearAlpha);
    this._renderer.autoClear = origAutoClear;
  }

  public setSize(width: number, height: number) {
    this.pickRenderTarget.setSize(width, height);
    this.debugRenderTarget?.setSize(width, height);
    if (this.debugBufferView) {
      this.debugBufferView.canvas.width = width;
      this.debugBufferView.canvas.height = height;
      this.debugBufferView.canvasForImage.width = width;
      this.debugBufferView.canvasForImage.height = height;
    }
  }

  public renderDebugCanvas() {
    if (!this.debugBufferView || !this.debugRenderTarget) return;

    // Full-screen debug view: no view-offset so we can see everything.
    this.processRender(this.debugRenderTarget);
    this.debugBufferView.render(this._renderer, this.debugRenderTarget);
  }

  private onMouseClick(event: MouseEvent) {
    const batchId = this.pickBatchIdAt(event.clientX, event.clientY);
    const pickArr = batchId > 0 ? [batchId] : [];
    this.onPickCallback(pickArr);
  }

  /**
   * Runs the single-pixel pick render at the given client coordinates and
   * returns the decoded batch ID (0 when nothing pickable is hit).
   */
  private pickBatchIdAt(clientX: number, clientY: number): number {
    const rect = this.element.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const pixelRatio = this._renderer.getPixelRatio();
    const fullWidth = this._renderer.getContext().drawingBufferWidth;
    const fullHeight = this._renderer.getContext().drawingBufferHeight;

    // gl_FragCoord-style pixel-space coords (centers at 0.5, 1.5, ...).
    // Clamp to valid viewport bounds.
    const pixelX = Math.max(
      0,
      Math.min(Math.floor(x * pixelRatio), fullWidth - 1),
    );
    const pixelY = Math.max(
      0,
      Math.min(Math.floor(y * pixelRatio), fullHeight - 1),
    );
    const pickingCoord = new Vector2(
      pixelX + 0.5,
      fullHeight - pixelY - 0.5, // flip Y for WebGL
    );
    const readY = fullHeight - 1 - pixelY;

    // Keep the camera projection unchanged for wide lines / screen-space
    // expanded shaders, and limit fragment work to one pixel via scissor.
    this._renderer.setScissor(pixelX, readY, 1, 1);
    this._renderer.setScissorTest(true);

    this.processRender(this.pickRenderTarget, pickingCoord);

    this._renderer.readRenderTargetPixels(
      this.pickRenderTarget,
      pixelX,
      readY,
      1,
      1,
      this.pixelBuffer,
    );

    this._renderer.setScissorTest(false);

    return (
      (this.pixelBuffer[0] << 16) +
      (this.pixelBuffer[1] << 8) +
      this.pixelBuffer[2]
    );
  }

  public dispose() {
    this.enablePick(false);
    this.pickRenderTarget.dispose();
    this.debugRenderTarget?.dispose();
    this.debugBufferView?.dispose();
  }
}
