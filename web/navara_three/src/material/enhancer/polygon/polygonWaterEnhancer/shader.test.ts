import { testShaderCompatibility } from "../../test-utils/shaderCompatibility";
import {
  POLYGON_BASE_SHADER_MARKERS,
  createPolygonBaseEnhancer,
} from "../polygonBaseEnhancer";

import { createPolygonWaterEnhancer, type SupportedMaterial } from ".";

testShaderCompatibility(
  "polygonWaterEnhancer",
  (material) =>
    createPolygonWaterEnhancer(
      createPolygonBaseEnhancer(material as SupportedMaterial),
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
  POLYGON_BASE_SHADER_MARKERS,
);
