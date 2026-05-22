// --- WebGPU migration notes ---
// On WebGPU adoption, replace this file with a `setupWebGPUNodesHandler`
// that:
//   - skips the `WebGLNodesHandler` + `getOutputCallback` patch (WebGPU
//     has native MRT and tone-mapping wiring),
//   - returns `WebGPURenderer.library` instead of reaching through
//     `WebGLNodesHandler.renderer.library`.
// `BasicNodeLibrary` consumers (LightDescs that register their
// light-node classes via `ViewContext.getNodeLibrary()`) survive as-is
// once they read from the WebGPU library (`StandardNodeLibrary`, which
// extends `NodeLibrary` with the same shape). The
// `DirectionalLight → StableDirectionalLightNode` override below is
// also renderer-agnostic — the precision issue it fixes occurs on
// WebGPU too — and should be kept in `setupWebGPUNodesHandler`.

import { DirectionalLight, type WebGLRenderer } from "three";
import { WebGLNodesHandler } from "three/examples/jsm/tsl/WebGLNodesHandler.js";
import type { BasicNodeLibrary, Node, OutputStructNode } from "three/webgpu";

import { StableDirectionalLightNode } from "./StableDirectionalLightNode";

// `WebGLNodesHandler`'s public .d.ts in @types/three doesn't expose the
// inner `renderer` proxy, `getOutputCallback`, or the `library` member.
// Augment with the surface we actually rely on so the rest of this module
// is cast-free.
declare module "three/examples/jsm/tsl/WebGLNodesHandler.js" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface WebGLNodesHandler {
    getOutputCallback: (outputNode: Node) => Node;
    renderer: {
      library: BasicNodeLibrary;
    };
  }
}

const isOutputStructNode = (node: Node): node is OutputStructNode =>
  "isOutputStructNode" in node && node.isOutputStructNode === true;

// Enable TSL on WebGLRenderer.
export const setupWebGLNodesHandler = (
  renderer: WebGLRenderer,
): BasicNodeLibrary => {
  // Bypass tone mapping / color-space wrapping when a material's outputNode
  // is an outputStruct (MRT output). Navara renders into a linear FBO and
  // handles its own color management in the postprocess pipeline.
  // WebGLNodesHandler's official .d.ts doesn't expose `getOutputCallback`,
  // but the JS source assigns it in the constructor and reads it at build
  // time from `this.getOutputCallback`, so we patch it after construction.
  // Ref: https://github.com/mrdoob/three.js/blob/d3b629c0c2097cec664ad16369bb6eae3b10e335/examples/jsm/tsl/WebGLNodesHandler.js#L305
  const nodesHandler = new WebGLNodesHandler();
  const originalGetOutput = nodesHandler.getOutputCallback;
  nodesHandler.getOutputCallback = (outputNode) =>
    isOutputStructNode(outputNode) ? outputNode : originalGetOutput(outputNode);

  renderer.setNodesHandler(nodesHandler);

  const library = nodesHandler.renderer.library;
  library.addLight(StableDirectionalLightNode, DirectionalLight);

  return library;
};
