import {
  highPrecisionUniformLocalVertexNode,
  highPrecisionViewPositionNode,
  highPrecisionWorldPositionNode,
} from "@navara/three";
import {
  Material,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshPhongMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
} from "three";
import { positionLocal } from "three/tsl";
import {
  MeshBasicNodeMaterial,
  MeshLambertNodeMaterial,
  MeshPhongNodeMaterial,
  MeshPhysicalNodeMaterial,
  MeshStandardNodeMaterial,
  NodeMaterial,
  type Node,
} from "three/webgpu";

/**
 * Construct the NodeMaterial counterpart of a loaded Three.js Material and
 * populate it via the base material class's `copy()`. We avoid the Node
 * material's own `copy()` because it pulls in `*Node` properties that don't
 * exist on legacy materials (returning `undefined`) and corrupts the new
 * material's defaults.
 *
 * Order matters: MeshPhysicalMaterial extends MeshStandardMaterial, so it
 * must be checked first.
 */
export function convertToNodeMaterial(source: Material): NodeMaterial {
  if (source instanceof MeshPhysicalMaterial) {
    const next = new MeshPhysicalNodeMaterial();
    MeshPhysicalMaterial.prototype.copy.call(next, source);
    return next;
  }
  if (source instanceof MeshStandardMaterial) {
    const next = new MeshStandardNodeMaterial();
    MeshStandardMaterial.prototype.copy.call(next, source);
    return next;
  }
  if (source instanceof MeshPhongMaterial) {
    const next = new MeshPhongNodeMaterial();
    MeshPhongMaterial.prototype.copy.call(next, source);
    return next;
  }
  if (source instanceof MeshLambertMaterial) {
    const next = new MeshLambertNodeMaterial();
    MeshLambertMaterial.prototype.copy.call(next, source);
    return next;
  }
  if (source instanceof MeshBasicMaterial) {
    const next = new MeshBasicNodeMaterial();
    MeshBasicMaterial.prototype.copy.call(next, source);
    return next;
  }
  console.warn(
    `convertToNodeMaterial: unrecognized material type ${source.type}; ` +
      `falling back to MeshStandardNodeMaterial.`,
  );
  const next = new MeshStandardNodeMaterial();
  MeshStandardMaterial.prototype.copy.call(
    next,
    source as MeshStandardMaterial,
  );
  return next;
}

/**
 * Apply TSL RTE (Relative-To-Eye) vertex nodes to a NodeMaterial.
 *
 * Sets up the four node slots needed for high-precision geospatial rendering:
 * - `vertexNode` — clips clip-space position via the encoded anchor uniforms
 * - `setupPositionView` — eye-relative view position (prevents specular jitter)
 * - `receivedShadowPositionNode` — world position for shadow receiving
 * - `castShadowPositionNode` — local position offset for shadow casting (f32 approx.)
 *
 * Pre-condition: the mesh's `matrixWorld` must have its translation stripped
 * (rotation/scale only). The anchor translation is supplied via the
 * `rtePosHigh`/`rtePosLow` uniforms.
 *
 * TODO: `castShadowPositionNode` is an f32 approximation that can produce
 * residual jitter as CSM repositions the shadow camera each frame. A proper
 * RTE fix requires passing the shadow camera position as a per-cascade uniform.
 * Implement after migrating to WebGPU.
 */
export function applyRTEToNodeMaterial(
  material: NodeMaterial,
  options: {
    rtePosHigh: Node<"vec3">;
    rtePosLow: Node<"vec3">;
    localOriginOffset: Node<"vec3">;
  },
): void {
  const { rtePosHigh, rtePosLow, localOriginOffset } = options;
  const rteOptions = { rtePosHigh, rtePosLow };
  material.vertexNode = highPrecisionUniformLocalVertexNode(rteOptions);
  material.setupPositionView = () => highPrecisionViewPositionNode(rteOptions);
  material.receivedShadowPositionNode =
    highPrecisionWorldPositionNode(rteOptions);
  material.castShadowPositionNode = positionLocal.add(localOriginOffset);
  material.needsUpdate = true;
}
