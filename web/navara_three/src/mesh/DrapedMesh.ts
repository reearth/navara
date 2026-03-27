import {
  AlwaysStencilFunc,
  BackSide,
  DecrementWrapStencilOp,
  FrontSide,
  IncrementWrapStencilOp,
  KeepStencilOp,
  Mesh,
  NotEqualStencilFunc,
  ZeroStencilOp,
  type BufferGeometry,
  type Material,
  type NormalBufferAttributes,
  type Object3DEventMap,
} from "three";

export class DrapedMesh<
  TGeometry extends BufferGeometry = BufferGeometry<NormalBufferAttributes>,
  TMaterial extends Material | Material[] = Material | Material[],
  TEventMap extends Object3DEventMap = Object3DEventMap,
> extends Mesh<TGeometry, TMaterial, TEventMap> {
  drapedEnable: boolean;

  constructor(geometry?: TGeometry, material?: TMaterial, enable = true) {
    super(geometry, material);
    this.drapedEnable = enable;
  }

  enabled() {
    return this.drapedEnable && this.visible
  }

  /**
   * Run the stencil-test draping passes for this mesh.
   * The caller supplies a `render` callback that performs the actual draw call
   * (e.g. `renderer.render(scene, camera)`).
   */
  process(render: () => void): void {
    if (!this.enabled()) return;

    let m;
    if (Array.isArray(this.material)) {
      m = this.material[0]
    } else {
      m = this.material
    };

    // Save original material state
    const origStencilFunc = m.stencilFunc;
    const origStencilFail = m.stencilFail;
    const origStencilZPass = m.stencilZPass;
    const origStencilZFail = m.stencilZFail;
    const origSide = m.side;
    const origColorWrite = m.colorWrite;
    const origDepthWrite = m.depthWrite;
    const origStencilWrite = m.stencilWrite;
    const origDepthTest = m.depthTest;

    // Back face pass
    m.stencilFunc = AlwaysStencilFunc;
    m.stencilFail = KeepStencilOp;
    m.stencilZPass = KeepStencilOp;
    m.stencilZFail = IncrementWrapStencilOp;
    m.side = BackSide;
    m.colorWrite = false;
    m.depthWrite = false;
    m.stencilWrite = true;
    m.depthTest = true;

    render();

    // Front face pass
    m.side = FrontSide;
    m.stencilZFail = DecrementWrapStencilOp;

    render();

    // Final pass
    m.stencilFunc = NotEqualStencilFunc;
    m.stencilFail = ZeroStencilOp;
    m.stencilZFail = ZeroStencilOp;
    m.stencilZPass = ZeroStencilOp;
    m.side = BackSide;
    m.colorWrite = true;
    m.depthTest = false;

    render();

    // Restore original material state
    m.stencilFunc = origStencilFunc;
    m.stencilFail = origStencilFail;
    m.stencilZPass = origStencilZPass;
    m.stencilZFail = origStencilZFail;
    m.side = origSide;
    m.colorWrite = origColorWrite;
    m.depthWrite = origDepthWrite;
    m.stencilWrite = origStencilWrite;
    m.depthTest = origDepthTest;
  }
}
