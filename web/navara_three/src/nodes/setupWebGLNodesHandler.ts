import { SunDirectionalLight } from "@takram/three-atmosphere";
import type { WebGLRenderer } from "three";
import { WebGLNodesHandler } from "three/examples/jsm/tsl/WebGLNodesHandler.js";
import {
  DirectionalLightNode,
  type Node,
  type OutputStructNode,
} from "three/webgpu";

// `WebGLNodesHandler`'s public .d.ts in @types/three doesn't expose the inner
// `renderer` proxy or its `library` / `getOutputCallback`. Augment with the
// surface we actually rely on so we can patch without `any` casts.
declare module "three/examples/jsm/tsl/WebGLNodesHandler.js" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface WebGLNodesHandler {
    getOutputCallback: (outputNode: Node) => Node;
    renderer: {
      library: {
        addLight: (
          lightNodeClass: typeof DirectionalLightNode,
          lightClass: typeof SunDirectionalLight,
        ) => void;
      };
    };
  }
}

const isOutputStructNode = (node: Node): node is OutputStructNode =>
  "isOutputStructNode" in node && node.isOutputStructNode === true;

// Enable TSL on WebGLRenderer.
export const setupWebGLNodesHandler = (renderer: WebGLRenderer) => {
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

  // Register `SunDirectionalLight` (extends `DirectionalLight`) against the
  // TSL `DirectionalLightNode`. The node library uses an exact-class Map
  // lookup (`NodeLibrary.getLightNodeClass`), so subclasses are not picked up
  // automatically — without this registration, `LightsNode.setupLightsNode`
  // warns `Light node not found for SunDirectionalLight` and drops the light,
  // producing unlit (black) fragments.
  //
  // `setRenderer` installs the proxy and its `library`, so we can only access
  // it AFTER `setNodesHandler` above.
  nodesHandler.renderer.library.addLight(
    DirectionalLightNode,
    SunDirectionalLight,
  );
};
