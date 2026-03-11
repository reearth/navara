import {
  degreeToRadian,
  geodeticToVector3,
  Color,
  type FogLightDefinition,
  type Layer as NavaraLayer,
  type LayerDescription,
} from "@navara/three";
import type { DefaultEffectLayerDeclarationDescription } from "@navara/three_default_plugin";
import { Layer, useViewContext } from "@navara/three_react";
import type { FeatureCollection, Point } from "geojson";
import { useEffect, useMemo, useRef, useState, type FC } from "react";

import { UC_PHOTOREALISTIC_DATASETS, FONT_DATASETS } from "./datasets";
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
      const p = geodeticToVector3({
        lat: degreeToRadian(lat),
        lng: degreeToRadian(lon),
        height: altitude,
      });
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
    layer.on("featureUpdated", ({ evaluator }) => {
      evaluator.evaluate(
        ({ properties }) => {
          const name = (properties?.["名称"] as string) ?? "";
          // Hide when there's no name
          if (!name) return { text: "" };
          return { text: name };
        },
        { filters: ["名称"] },
      );
    });
  };

  const textLayerDesc = useMemo((): LayerDescription | null => {
    return {
      type: "mvt",
      data: {
        url: "/mvt/11100_saitama-shi_city_2024_shelter_mvt/{z}/{x}/{y}.pbf",
      },
      // Render labels using instanced text anchored at point positions.
      text: {
        color: new Color().setStyle("#ffffff"),
        font: FONT_DATASETS.NotoSansJP.url,
        size: 15,
        clampToGround: true,
        scaleByDistance: true,
        height: 10,
        depthTest: false,
        outlineWidth: 2,
        outlineColor: new Color().setStyle("#111111"),
        show: visible,
      },
      vectorTile: {
        maxZoom: 16,
      },
    };
  }, [visible]);

  const fogLayerDesc = useMemo(():
    | LayerDescription
    | DefaultEffectLayerDeclarationDescription
    | null => {
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
