import { testShaderCompatibility } from "../../test-utils/shaderCompatibility";
import {
  MODEL_BASE_SHADER_MARKERS,
  createModelBaseEnhancer,
} from "../modelBaseEnhancer";

import { createModelWaterEnhancer, type SupportedMaterial } from ".";

testShaderCompatibility(
  "modelWaterEnhancer",
  (material) =>
    createModelWaterEnhancer(
      createModelBaseEnhancer(material as SupportedMaterial),
    ),
  [
    {
      name: "With water",
      props: {
        water: {
          water: true,
        },
      },
    },
    {
      name: "Without water",
      props: {
        water: {
          water: false,
        },
      },
    },
  ],
  MODEL_BASE_SHADER_MARKERS,
);
