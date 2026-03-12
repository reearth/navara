import { Color } from "@navara/three";
import type { Layer as NavaraLayer, FeatureUpdatedParams } from "@navara/three";
import { Layer } from "@navara/three_react";
import { useEffect, useMemo, useRef, useState } from "react";

import { czmlToGeoJSON, type GeoJSONFC } from "./czml";
import type { LayerDescriptions } from "./type";

export type FloodLayerProps = {
  url: string;
  visible: boolean;
  transparent?: boolean;
  cloudsEffectVisible?: boolean;
  // 0..100 progress mapped over the simulation time span
  progressPercent: number;
  outline?: boolean;
  waterSurface?: boolean;
  /**
   * Callback to provide the calculated simulation duration in hours
   * Calculated from CZML time span (first to last time point)
   */
  onSimulationHoursCalculated?: (hours: number) => void;
  /**
   * Callback to provide the simulation start date
   */
  onSimulationStartDateCalculated?: (startDate: Date) => void;
  /**
   * Callback to provide the current simulation date based on progress
   */
  onCurrentDateChange?: (currentDate: Date) => void;
};

const DEFAULT_POLY_COLOR = new Color().setStyle("#72501a");
const DEFAULT_POINT_COLOR = new Color().setStyle("#b30000");

export function FloodLayer({
  url,
  visible,
  progressPercent,
  transparent = false,
  waterSurface = false,
  onSimulationHoursCalculated,
  onSimulationStartDateCalculated,
  onCurrentDateChange,
}: FloodLayerProps) {
  const [fc, setFc] = useState<GeoJSONFC | null>(null);
  const layerRef = useRef<NavaraLayer | null>(null);
  const currentTimeRef = useRef<string>("");

  // Load CZML once
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(url);
        const json = await res.json();
        const gj = czmlToGeoJSON(json);
        if (!mounted) return;
        setFc(gj);

        // Calculate simulation hours from time span
        if (gj.timeSpan) {
          const startDate = new Date(gj.timeSpan.start);
          const endDate = new Date(gj.timeSpan.end);
          const durationMs = endDate.getTime() - startDate.getTime();
          const durationHours = durationMs / (1000 * 60 * 60);

          if (onSimulationHoursCalculated) {
            onSimulationHoursCalculated(durationHours);
          }

          if (onSimulationStartDateCalculated) {
            onSimulationStartDateCalculated(startDate);
          }
        }
      } catch (e) {
        console.error("Failed to load CZML:", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [url, onSimulationHoursCalculated, onSimulationStartDateCalculated]);

  // Calculate current time based on progress percent
  const currentTime = useMemo(() => {
    if (!fc?.timeSpan) return "";

    const startDate = new Date(fc.timeSpan.start);
    const endDate = new Date(fc.timeSpan.end);
    const duration = endDate.getTime() - startDate.getTime();
    const offset = (progressPercent / 100) * duration;
    const currentDate = new Date(startDate.getTime() + offset);

    return currentDate.toISOString();
  }, [fc, progressPercent]);

  currentTimeRef.current = currentTime;

  // Keep an up-to-date ref for evaluator closure
  useEffect(() => {
    // Notify parent of current date change
    if (currentTime && onCurrentDateChange) {
      onCurrentDateChange(new Date(currentTime));
    }
  }, [currentTime, onCurrentDateChange]);

  const onReady = (layer: NavaraLayer) => {
    layerRef.current = layer;
    const onUpdate = ({ evaluator }: FeatureUpdatedParams) => {
      evaluator.evaluate(
        ({ properties }) => {
          const kind = (properties?.["kind"] as string) || "";
          const color =
            kind === "point" ? DEFAULT_POINT_COLOR : DEFAULT_POLY_COLOR;

          // Check if feature is available at current time
          const availabilities = properties?.["availabilities"] as
            | Record<"start" | "end", string>[]
            | undefined;

          // If no availabilities specified, feature is always shown
          if (!availabilities || availabilities.length === 0) {
            return {
              color,
              show: true,
            };
          }

          // Check availability against current time
          const currentTimeISO = currentTimeRef.current;
          if (!currentTimeISO) {
            return {
              color: new Color(),
              show: false,
            };
          }

          const currentDate = new Date(currentTimeISO);
          const isAvailable = availabilities.some((av) => {
            const start = new Date(av["start"] ?? "");
            const end = new Date(av["end"] ?? "");
            return currentDate >= start && currentDate < end;
          });

          if (!isAvailable) {
            return {
              color: new Color(),
              show: false,
            };
          }

          return {
            color,
            show: true,
          };
        },
        { filters: ["kind", "availabilities"] },
      );
    };
    // Attach per-feature evaluator: set color + show based on availability
    const handler = (params: FeatureUpdatedParams) => onUpdate(params);
    layer.on("featureUpdated", handler);
    return () => layer.off("featureUpdated", handler);
  };

  const layerDesc = useMemo((): LayerDescriptions | null => {
    if (!fc || !visible) return null;
    return {
      type: "geojson",
      data: fc,
      polygon: {
        color: DEFAULT_POLY_COLOR,
        clampToGround: false,
        water: waterSurface,
        perPositionHeight: true,
        height: -22.0,
        reflectivity: transparent ? 0.0 : 0.3,
        waterScaleNormal: 0.3,
        extrudedHeight: 1,
        transparent,
        opacity: 0.9,
        specular: true,
        applyWaterNormal: false,
        receiveShadow: true,
      },
    };
  }, [fc, visible, waterSurface, transparent]);

  // Re-evaluate show/color without replacing data when the current time changes
  useEffect(() => {
    if (layerRef.current) layerRef.current.forceUpdate();
  }, [currentTime]);

  // Render two layers so polygons and points can style independently
  return layerDesc ? (
    <Layer<NavaraLayer> config={layerDesc} onReady={onReady} />
  ) : null;
}
