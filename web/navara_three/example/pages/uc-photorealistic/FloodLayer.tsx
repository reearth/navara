import type { Layer as NavaraLayer, LayerDescription } from "@navara/three";
import { Layer } from "@navara/three_react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Color } from "../../../src/Color";

import { czmlToGeoJSON, type GeoJSONFC } from "./czml";

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

const DEFAULT_POLY_COLOR = 0x72501a;
const DEFAULT_POINT_COLOR = 0xb30000;

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

  // Track whether water_normal should be temporarily disabled during slider changes
  const [waterNormalEnabled, setWaterNormalEnabled] = useState(waterSurface);
  const waterNormalTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Disable water_normal while slider is being changed, re-enable after 100ms
  useEffect(() => {
    // Disable water_normal immediately when progress changes
    setWaterNormalEnabled(false);

    // Clear any existing timer
    if (waterNormalTimerRef.current) {
      clearTimeout(waterNormalTimerRef.current);
    }

    waterNormalTimerRef.current = setTimeout(() => {
      setWaterNormalEnabled(waterSurface);
    }, 100);

    // Cleanup on unmount
    return () => {
      if (waterNormalTimerRef.current) {
        clearTimeout(waterNormalTimerRef.current);
      }
    };
  }, [progressPercent, waterSurface]);

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

  // Keep an up-to-date ref for evaluator closure
  useEffect(() => {
    currentTimeRef.current = currentTime;

    // Notify parent of current date change
    if (currentTime && onCurrentDateChange) {
      onCurrentDateChange(new Date(currentTime));
    }
  }, [currentTime, onCurrentDateChange]);

  const onReady = (layer: NavaraLayer) => {
    layerRef.current = layer;
    // Attach per-feature evaluator: set color + show based on availability
    layer.on("featureUpdated", (evaluator) => {
      evaluator.evaluate((_batchId, property) => {
        const kind = (property?.get("kind") as string) || "";
        const color =
          kind === "point" ? DEFAULT_POINT_COLOR : DEFAULT_POLY_COLOR;

        // Check if feature is available at current time
        const availabilities = property?.get("availabilities") as
          | Map<"start" | "end", string>[]
          | undefined;

        // If no availabilities specified, feature is always shown
        if (!availabilities || availabilities.length === 0) {
          return {
            color: new Color().setHex(color),
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
          const start = new Date(av.get("start") ?? "");
          const end = new Date(av.get("end") ?? "");
          return currentDate >= start && currentDate < end;
        });

        if (!isAvailable) {
          return {
            color: new Color(),
            show: false,
          };
        }

        return {
          color: new Color().setHex(color),
          show: true,
        };
      });
    });
  };

  const layerDesc = useMemo<LayerDescription | null>(() => {
    if (!fc || !visible) return null;
    return {
      type: "geojson",
      data: fc,
      polygon: {
        color: DEFAULT_POLY_COLOR,
        clamp_to_ground: false,
        outline_show: false,
        water: waterNormalEnabled,
        per_position_height: true,
        height: -22.0,
        reflectivity: transparent ? 0.0 : 0.3,
        water_scale_normal: 0.3,
        extruded_height: 1,
        transparent,
        opacity: 0.9,
        show: false,
        specular: true,
        apply_water_normal: false,
        receive_shadow: true,
      },
    };
  }, [fc, visible, waterNormalEnabled, transparent]);

  // Re-evaluate show/color without replacing data when the current time changes
  useEffect(() => {
    if (layerRef.current) layerRef.current.forceUpdate();
  }, [currentTime]);

  // Render two layers so polygons and points can style independently
  return layerDesc ? (
    <Layer<NavaraLayer> config={layerDesc} onReady={onReady} />
  ) : null;
}
