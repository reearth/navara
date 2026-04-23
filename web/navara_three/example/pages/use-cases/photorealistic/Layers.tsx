import {
  JAPAN_GSI_ELEVATION_DECODER,
  Color,
  type LayerDescription,
} from "@navara/three";
import type { RainMeshConfig, CloudsConfig } from "@navara/three_default_descs";
import type {
  DefaultPlugin,
  DefaultEffectDescription,
  DefaultLightDescription,
} from "@navara/three_default_plugin";
import {
  Layer,
  MeshDesc,
  LightDesc,
  EffectDesc,
  useViewContext,
} from "@navara/three_react";
import { useEffect, useMemo, type FC } from "react";
import { SphericalHarmonics3, Vector2 } from "three";

import { SH_COEFFICIENTS } from "../../../helpers/sh";

import {
  BuildingTilesLayer,
  type BuildingColorAttribute,
} from "./BuildingLayer";
import { BUILDING_DATASETS, UC_PHOTOREALISTIC_DATASETS } from "./datasets";
import { useDefaultLayers } from "./hooks";
import { useNightContext } from "./NightContext";
import { QUALITY, type QualityFlags } from "./quality";

export type SceneLayerToggles = {
  defaultPlugin: DefaultPlugin;
  buildingsVisible?: boolean;
  buildingColorAttribute?: BuildingColorAttribute;
  cloudsEffectVisible?: boolean;
  rainVisible?: boolean;
  quality?: QualityFlags;
  cloudShadow?: boolean;
  waterSurface?: boolean;
  waterAreaVisible?: boolean;
  individualBuildingVisibility?: boolean[];
};

export const Layers: FC<SceneLayerToggles> = ({
  defaultPlugin,
  buildingsVisible = true,
  buildingColorAttribute = "bldg:measuredHeight",
  cloudsEffectVisible = true,
  rainVisible = false,
  quality = "high",
  cloudShadow = false,
  waterSurface = false,
  waterAreaVisible = false,
  individualBuildingVisibility = BUILDING_DATASETS.map(() => true),
}) => {
  const { view } = useViewContext();

  const defaultLayers = useDefaultLayers(view, defaultPlugin);

  const { isNight } = useNightContext();

  // Descriptions
  const baseTiles = useMemo(
    (): LayerDescription => ({
      type: "tiles",
      data: { url: UC_PHOTOREALISTIC_DATASETS.baseRaster.url },
      rasterTile: { minZoom: 2, maxZoom: 18 },
    }),
    [],
  );

  const terrain = useMemo(
    (): LayerDescription => ({
      type: "terrain",
      data: { url: UC_PHOTOREALISTIC_DATASETS.terrain.url },
      rasterTerrain: {
        minZoom: 6,
        maxZoom: 15,
        elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
        castShadow: true,
        receiveShadow: true,
      },
    }),
    [],
  );

  const cloudsEffect = useMemo(
    (): CloudsConfig => ({
      clouds: {
        coverage: cloudsEffectVisible ? 0.5 : 0,
        localWeatherVelocity: new Vector2(0.005, 0.001),
        absorptionCoefficient: 5,
        haze: true,
        hazeDensityScale: 0.001,
        hazeExponent: 0.002,
        hazeAbsorptionCoefficient: 1.5,
        ...QUALITY[quality]?.clouds,
      },
    }),
    [cloudsEffectVisible, quality],
  );

  const rainDesc = useMemo(
    (): RainMeshConfig => ({
      visible: rainVisible,
      rain: {
        particleCount: 5000,
        followCamera: true,
      },
    }),
    [rainVisible],
  );

  const rainDropEffect = useMemo(
    (): DefaultEffectDescription => ({
      rainDrop: {
        opacity: 0.5,
        dropDensity: 0.2,
        refractionStrength: 0.2,
        dropSizeFactor: 0.03,
        dropGridSize: 25,
        ...QUALITY[quality]?.rainDrop,
      },
      visible: rainVisible,
    }),
    [rainVisible, quality],
  );

  const ssrEffect = useMemo(
    (): DefaultEffectDescription => ({
      ssr: {
        iterations: QUALITY[quality]?.ssr?.iterations,
        useConeTracing: QUALITY[quality]?.ssr?.useConeTracing,
      },
      visible: !!QUALITY[quality].ssr,
    }),
    [quality],
  );

  const mvtDesc = useMemo(
    (): LayerDescription => ({
      type: "mvt",
      data: {
        url: UC_PHOTOREALISTIC_DATASETS.waterMvt.url,
      },
      polygon: {
        color: new Color().setStyle("#72501a"),
        reflectivity: 0.3,
        clampToGround: true,
        wireframe: false,
        water: waterSurface,
        shininess: 100,
        specularStrength: 2,
        waterScaleNormal: 0.5,
        applyWaterNormal: false,
        receiveShadow: true,
        specular: true,
      },
      vectorTile: {
        maxZoom: 16,
        layers: ["waterarea"],
      },
    }),
    [waterSurface],
  );

  // Night scene tuning inspired by example/pages/night
  useEffect(() => {
    // Boost stars and enable at night; keep subtle in day
    defaultLayers?.stars?.update({
      stars: isNight
        ? { intensity: 50, pointSize: 1.5 }
        : { intensity: 1, pointSize: 1 },
    });
  }, [defaultLayers, isNight]);

  useEffect(() => {
    if (!defaultLayers) return;
    defaultLayers.sun?.update({
      sun: {
        castShadow: true,
        ...QUALITY[quality]?.sun,
      },
    });
  }, [defaultLayers, quality]);

  useEffect(() => {
    if (!defaultLayers) return;
    defaultLayers.skyEnv.update({
      sky: {
        sunAngularRadius: cloudsEffectVisible ? 0.0001 : 0.1,
      },
    });
  }, [defaultLayers, cloudsEffectVisible]);

  // Clouds shadow: enable/disable aerial perspective irradiance
  useEffect(() => {
    if (!defaultLayers) return;
    defaultLayers.aerialPerspective?.update?.({
      aerialPerspective: { irradiance: !!cloudShadow },
    });
  }, [defaultLayers, cloudShadow]);

  const nightLightProbe = useMemo(
    (): DefaultLightDescription => ({
      lightProbe: {
        sh: new SphericalHarmonics3().set(SH_COEFFICIENTS.night),
        intensity: 0.03,
      },
      visible: isNight,
    }),
    [isNight],
  );

  return (
    <>
      <Layer config={baseTiles} />
      <Layer config={terrain} />
      {buildingsVisible &&
        BUILDING_DATASETS.map((dataset, index) =>
          individualBuildingVisibility[index] ? (
            <BuildingTilesLayer
              key={dataset.url}
              url={dataset.url}
              colorBy={buildingColorAttribute}
              heightDomain={dataset.heightDomain}
              heightOffset={dataset.heightOffset}
            />
          ) : null,
        )}
      {defaultLayers && (
        <>
          <EffectDesc config={cloudsEffect} />
          <EffectDesc config={ssrEffect} />
        </>
      )}
      <MeshDesc config={rainDesc} />
      {rainVisible && defaultLayers && <EffectDesc config={rainDropEffect} />}
      <LightDesc config={nightLightProbe} />
      {waterAreaVisible && <Layer config={mvtDesc} />}
    </>
  );
};
