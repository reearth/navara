import type {
  SunLightLayerConfig,
  CloudsConfig,
  RainDropConfig,
  SSRConfig,
} from "@navara/three_default_layers";

export type QualityFlags = "ultra" | "high" | "medium" | "low";

export const QUALITY: Record<
  QualityFlags,
  Partial<
    Pick<CloudsConfig, "clouds"> &
      Pick<RainDropConfig, "rainDrop"> &
      Pick<SSRConfig, "ssr"> &
      Pick<SunLightLayerConfig, "sun">
  >
> = {
  ultra: {
    clouds: {
      qualityPreset: "ultra",
    },
    rainDrop: {
      dropLayers: 4,
    },
    ssr: {
      iterations: 200,
      useConeTracing: true,
    },
    sun: {
      shadowCascadeCount: 4,
    },
  },
  high: {
    clouds: {
      qualityPreset: "high",
    },
    rainDrop: {
      dropLayers: 4,
    },
    ssr: {
      iterations: 100,
      useConeTracing: true,
    },
    sun: {
      shadowCascadeCount: 4,
    },
  },
  medium: {
    clouds: {
      qualityPreset: "medium",
    },
    rainDrop: {
      dropLayers: 2,
    },
    ssr: {
      iterations: 50,
      useConeTracing: true,
    },
    sun: {
      shadowCascadeCount: 3,
    },
  },
  low: {
    clouds: {
      qualityPreset: "low",
    },
    rainDrop: {
      dropLayers: 1,
    },
    // ssr: {}, // disabled
    sun: {
      shadowCascadeCount: 2,
    },
  },
};
