import {
  degreeToRadian,
  geodeticToVector3,
  LLE,
  type FogLightDefinition,
  type Layer as NavaraLayer,
  type LayerDescription,
  type MvtLayer,
} from "@navara/three";
import { Layer, useViewContext } from "@navara/three_react";
import type { FeatureCollection, Point } from "geojson";
import { useEffect, useMemo, useRef, useState, type FC } from "react";

import { UC_PHOTOREALISTIC_DATASETS } from "./datasets";
import { useNightContext } from "./NightContext";

export const ShelterLayer: FC<{ visible?: boolean }> = ({
  visible = false,
}) => {
  const { view } = useViewContext();
  const [fc, setFc] = useState<FeatureCollection<Point> | null>(null);
  const textLayerRef = useRef<NavaraLayer | null>(null);
  const { isNight } = useNightContext();

  // Load shelter GeoJSON
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(UC_PHOTOREALISTIC_DATASETS.shelterGeojson.url);
        const json = (await res.json()) as FeatureCollection<Point>;
        if (!mounted) return;
        setFc(json);
      } catch (e) {
        console.warn("Failed to load shelter GeoJSON:", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Extract point features for fog lights
  const fogLights = useMemo<FogLightDefinition[]>(() => {
    if (!fc) return [];
    const lights: FogLightDefinition[] = [];
    for (const f of fc.features) {
      if (f?.geometry?.type !== "Point") continue;
      const [lon, lat] = f.geometry.coordinates as [number, number, number?];
      const altitude = 20;
      const lle = new LLE(degreeToRadian(lat), degreeToRadian(lon), altitude);
      const p = geodeticToVector3(lle);
      lights.push({
        position: { x: p.x, y: p.y, z: p.z },
        color: 0xffd580,
        intensity: 1.25,
        radius: 450,
      });
    }
    return lights;
  }, [fc]);

  const onTextLayerReady = (layer: NavaraLayer) => {
    textLayerRef.current = layer;
    layer.on("featureUpdated", (evaluator) => {
      evaluator.evaluate((_batchId, property) => {
        const name = (property?.get("名称") as string) ?? "";
        // Hide when there's no name
        if (!name) return { text: "" };
        return { text: name };
      });
    });
  };

  const textLayerDesc = useMemo<LayerDescription | null>(() => {
    return {
      type: "mvt",
      data: {
        url: "/mvt/11100_saitama-shi_city_2024_shelter_mvt/{z}/{x}/{y}.pbf",
      },
      // Render labels using instanced text anchored at point positions.
      text: {
        color: 0xffffff,
        size: 15,
        clamp_to_ground: true,
        scale_by_distance: true,
        height: 10,
        depth_test: false,
        outline_width: 2,
        outline_color: 0x111111,
        show: visible,
      },
      vector_tile: {
        max_zoom: 16,
      },
    } as MvtLayer;
  }, [visible]);

  const fogLayerDesc = useMemo<LayerDescription | null>(() => {
    if (!view || fogLights.length === 0) return null;
    return {
      type: "effect",
      fogLight: {
        lights: fogLights,
        fogDensity: 0.7,
        useSurfaceLighting: true,
        downsample: 2,
        maxLightsPerTile: 128,
        maxLights: 400,
      },
      visible: visible && isNight,
    };
  }, [view, visible, isNight, fogLights]);

  return (
    <>
      {textLayerDesc && (
        <Layer<NavaraLayer> config={textLayerDesc} onReady={onTextLayerReady} />
      )}
      {fogLayerDesc && <Layer<NavaraLayer> config={fogLayerDesc} />}
    </>
  );
};
