import { JAPAN_GSI_ELEVATION_DECODER, Color } from "@navara/three";
import type { RainMeshConfig } from "@navara/three_default_layers";
import type { DefaultPlugin } from "@navara/three_default_plugin";
import { Layer, useViewContext } from "@navara/three_react";
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
import type { LayerDescriptions } from "./type";

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
    (): LayerDescriptions => ({
      type: "tiles",
      data: { url: UC_PHOTOREALISTIC_DATASETS.baseRaster.url },
      rasterTile: { minZoom: 2, maxZoom: 18 },
    }),
    [],
  );

  const terrain = useMemo(
    (): LayerDescriptions => ({
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
    (): LayerDescriptions => ({
      type: "effect",
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
      type: "mesh",
      visible: rainVisible,
      rain: {
        particleCount: 5000,
        followCamera: true,
      },
    }),
    [rainVisible],
  );

  const rainDropEffect = useMemo(
    (): LayerDescriptions => ({
      type: "effect",
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
    (): LayerDescriptions => ({
      type: "effect",
      ssr: {
        iterations: QUALITY[quality]?.ssr?.iterations,
        useConeTracing: QUALITY[quality]?.ssr?.useConeTracing,
      },
      visible: !!QUALITY[quality].ssr,
    }),
    [quality],
  );

  const mvtLayerDescription = useMemo(
    (): LayerDescriptions => ({
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
    (): LayerDescriptions => ({
      type: "light",
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
          <Layer config={cloudsEffect} />
          <Layer config={ssrEffect} />
        </>
      )}
      <Layer config={rainDesc} />
      {rainVisible && defaultLayers && <Layer config={rainDropEffect} />}
      <Layer config={nightLightProbe} />
      {waterAreaVisible && <Layer config={mvtLayerDescription} />}
    </>
  );
};
