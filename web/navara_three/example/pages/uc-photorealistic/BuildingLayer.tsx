import { Color } from "@navara/three";
import type {
  Layer as NavaraLayer,
  LayerDescription,
  ColorTuple,
  FeatureEvaluatorCallback,
 FeatureEvaluator } from "@navara/three";
import { Layer } from "@navara/three_react";
import { useEffect, useMemo, useRef } from "react";

import { PLATEAU_COLOR_MAP } from "../../helpers/colors";

export type BuildingColorAttribute =
  | "none"
  | "bldg:measuredHeight"
  | "uro:BuildingDetailAttribute_uro:fireproofStructureType"
  | "荒川水系荒川（国管理区間）_L2（想定最大規模）_浸水ランクコード";

export type BuildingLayerProps = {
  url: string;
  visible?: boolean;
  colorBy: BuildingColorAttribute;
  /** Optional: normalization domain for measured height (meters) */
  heightDomain?: { min: number; max: number };
  /** Optional: vertical offset to align with terrain */
  heightOffset?: number;
};

// Use the shared Plateau sequential colormap from helpers (same as override-material example)
export const MEASURED_HEIGHT_GRADIENT: (string | ColorTuple)[] =
  PLATEAU_COLOR_MAP.ticks([0, 1], 12).map((t) => {
    const [r, g, b] = PLATEAU_COLOR_MAP.linear(t);
    return [r * 255, g * 255, b * 255];
  });

export const FIREPROOF_COLOR_MAP: Record<string, ColorTuple> = {
  耐火: [92, 92, 94],
  準耐火造: [140, 155, 177],
  その他: [250, 131, 158],
  不明: [120, 194, 243],
};

export const FLOOD_RANK_COLOR_MAP: Record<number, ColorTuple> = {
  6: [220, 122, 220], // 20m〜
  5: [242, 133, 201], // 10m〜20m
  4: [255, 145, 145], // 5m〜10m
  3: [255, 183, 183], // 3m〜5m
  2: [255, 216, 192], // 0.5m〜3m
  1: [247, 245, 169], // 〜0.5m
};

function rampFromColorMap(t01: number) {
  const [r, g, b] = PLATEAU_COLOR_MAP.linear(t01);
  return new Color().setRGB(r, g, b);
}

function readProperty(property: Map<string, unknown> | undefined, key: string) {
  const direct = property?.get(key);
  if (direct != null) return direct as unknown;
  const attributesRaw = property?.get("attributes");
  if (typeof attributesRaw === "string") {
    try {
      const attrs = JSON.parse(attributesRaw) as Record<string, unknown>;
      return attrs[key];
    } catch {
      // ignore malformed JSON
    }
  }
  return undefined;
}

export function BuildingTilesLayer({
  url,
  colorBy,
  visible = true,
  heightDomain = { min: 0, max: 60 },
  heightOffset = -45,
}: BuildingLayerProps) {
  const layerRef = useRef<NavaraLayer | null>(null);
  const paramsRef = useRef({ colorBy, heightDomain });

  paramsRef.current.colorBy = colorBy;
  paramsRef.current.heightDomain = heightDomain;

  const layerDesc = useMemo((): LayerDescription | null => {
    if (!visible) return null;
    return {
      type: "cesium3dtiles",
      data: { url },
      model: {
        show: true,
        color: new Color().setStyle("#ffffff"),
        metalness: 0,
        roughness: 1,
        castShadow: true,
        receiveShadow: true,
        height: heightOffset,
      },
    };
  }, [url, visible, heightOffset]);

  const onReady = (layer: NavaraLayer) => {
    layerRef.current = layer;
    const onFeatureUpdated: FeatureEvaluatorCallback = (evaluator) => {
      const fallback = new Color().setHex(0xffffff);
      const { colorBy, heightDomain } = paramsRef.current;

      evaluator.evaluate((_batchId, property) => {
        if (colorBy === "none") {
          return { color: fallback };
        }

        if (colorBy === "bldg:measuredHeight") {
          const v = readProperty(property, "bldg:measuredHeight");
          let h = typeof v === "number" ? v : Number(v);
          if (!Number.isFinite(h)) {
            h = 0;
          }
          const t01 =
            (h - heightDomain.min) /
            Math.max(1e-6, heightDomain.max - heightDomain.min);
          const color = rampFromColorMap(t01);
          return { color };
        }

        if (
          colorBy === "uro:BuildingDetailAttribute_uro:fireproofStructureType"
        ) {
          const raw = readProperty(
            property,
            "uro:BuildingDetailAttribute_uro:fireproofStructureType",
          );
          const key = String(raw ?? "不明");
          const tuple = FIREPROOF_COLOR_MAP[key] ?? FIREPROOF_COLOR_MAP["不明"];
          const [r, g, b] = tuple;
          return { color: new Color().setRGB(r / 255, g / 255, b / 255) };
        }

        if (
          colorBy ===
          "荒川水系荒川（国管理区間）_L2（想定最大規模）_浸水ランクコード"
        ) {
          const raw = readProperty(
            property,
            "荒川水系荒川（国管理区間）_L2（想定最大規模）_浸水ランクコード",
          );
          const n = typeof raw === "number" ? raw : Number(raw);
          if (!Number.isFinite(n)) return { color: fallback };
          const [r, g, b] = FLOOD_RANK_COLOR_MAP[n];
          return { color: new Color().setRGB(r / 255, g / 255, b / 255) };
        }

        return { color: fallback };
      });
    };
    const handler = ({ evaluator }: { evaluator: FeatureEvaluator }) =>
      onFeatureUpdated(evaluator);
    layer.on("featureUpdated", handler);
    return () => layer.off("featureUpdated", handler);
  };

  // Re-evaluate when coloring parameters change
  useEffect(() => {
    if (layerRef.current) layerRef.current.forceUpdate();
  }, [colorBy, heightDomain.min, heightDomain.max]);

  if (!layerDesc) return null;
  return <Layer<NavaraLayer> config={layerDesc} onReady={onReady} />;
}
