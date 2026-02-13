import { testShaderCompatibility } from "../../test-utils/shaderCompatibility";

import { POLYLINE_BASE_SHADER_MARKERS } from "./markers";

import { createPolylineBaseEnhancer, type SupportedMaterial } from ".";

testShaderCompatibility(
  "polylineBaseEnhancer",
  (material) => createPolylineBaseEnhancer(material as SupportedMaterial),
  [
    {
      name: "With RTE",
      props: {
        useRTE: true,
      },
    },
    {
      name: "Without RTE",
      props: {
        useRTE: false,
      },
    },
    {
      name: "With clampToGround",
      props: {
        clampToGround: true,
        isTexturized: false,
      },
    },
    {
      name: "With isTexturized",
      props: {
        isTexturized: true,
      },
    },
  ],
  POLYLINE_BASE_SHADER_MARKERS,
);
