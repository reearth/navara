import { testShaderCompatibility } from "../../test-utils/shaderCompatibility";

import { SHADOW_MAP_DEPTH_SHADER_MARKERS } from "./markers";

import { createShadowMapDepthEnhancer, type SupportedMaterial } from ".";

testShaderCompatibility(
  "shadowMapDepthEnhancer",
  (material) => createShadowMapDepthEnhancer(material as SupportedMaterial),
  [
    {
      name: "Default props",
      props: {},
    },
  ],
  SHADOW_MAP_DEPTH_SHADER_MARKERS,
);
