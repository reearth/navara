import type {
  Feature,
  FeatureCollection,
  Point,
  Polygon,
  Position,
} from "geojson";

// ---- Feature Properties ----
export type FeatureProperties = {
  czml_id?: string | null;
  name?: string | null;
  // Array of availability time ranges for this feature
  availabilities: { start: string; end: string }[];
  perPositionHeight?: boolean;
  pixelSize?: number | null;
  kind: "polygon" | "point";
  color?: number[]; // [r,g,b,(a)] in 0-255
};

export type GeoJSONFeature = Feature<Point | Polygon, FeatureProperties>;
export type GeoJSONFC = FeatureCollection<
  Point | Polygon,
  FeatureProperties
> & {
  timeSpan?: { start: string; end: string } | null;
};

// ---- CZML (minimal subset, degrees only) ----
export type RGBA = [number, number, number] | [number, number, number, number];

export type CzmlColor = {
  rgba?: RGBA | number[];
};

export type CzmlMaterial = {
  solidColor?: { color?: CzmlColor };
  color?: CzmlColor;
};

export type CzmlPositionDegrees = {
  cartographicDegrees: number[]; // [lon,lat,height, ...] or [t,lon,lat,height, ...]
  epoch?: string; // when used with [t, ...] values
};

export type CzmlHolePositionsDegrees = {
  cartographicDegrees: number[];
};

export type CzmlPolygonHierarchyDegrees = {
  positions?: CzmlHolePositionsDegrees | CzmlPositionDegrees;
  holes?: { positions?: CzmlHolePositionsDegrees | CzmlPositionDegrees }[];
  cartographicDegrees?: number[];
};

export type CzmlPolygon = {
  positions?: CzmlPositionDegrees;
  hierarchy?: CzmlPolygonHierarchyDegrees;
  holes?:
    | { cartographicDegrees?: number[][] | number[] }
    | {
        holes?: {
          positions?: CzmlHolePositionsDegrees | CzmlPositionDegrees;
        }[];
      };
  perPositionHeight?: boolean;
  material?: CzmlMaterial;
};

export type CzmlPoint = {
  pixelSize?: number;
  color?: CzmlColor;
  outlineColor?: CzmlColor;
};

export type CzmlBillboard = {
  color?: CzmlColor;
};

export type CzmlPacket = {
  id?: string;
  name?: string;
  availability?: string;
  polygon?: CzmlPolygon;
  point?: CzmlPoint;
  billboard?: CzmlBillboard;
  position?: CzmlPositionDegrees;
};

function ensureClosed(ring: Position[]): Position[] {
  if (!ring.length) return ring;
  const a = ring[0];
  const b = ring[ring.length - 1];
  if (a[0] !== b[0] || a[1] !== b[1]) ring.push(a);
  return ring;
}

function flatToRingDegrees(arr: number[]): Position[] {
  const out: Position[] = [];
  for (let i = 0; i + 2 < arr.length; i += 3) {
    const lon = arr[i];
    const lat = arr[i + 1];
    const h = arr[i + 2] ?? 0;
    out.push([lon, lat, h]);
  }
  return ensureClosed(out);
}

function expandAvailability(av?: string): string[] {
  if (!av) return [];
  return av
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function polygonCoordsFromCzml(
  polygon: CzmlPolygon,
): { outer: Position[]; holes: Position[][] } | null {
  if (!polygon) return null;

  // 1) polygon.positions.cartographicDegrees
  const pos = polygon.positions;
  if (pos?.cartographicDegrees && pos.cartographicDegrees.length >= 6)
    return {
      outer: flatToRingDegrees(pos.cartographicDegrees),
      holes: extractHolesDegrees(polygon.holes),
    };

  // 2) polygon.hierarchy.positions.cartographicDegrees
  const hier = polygon.hierarchy;
  const hierPos = hier?.positions as
    | CzmlHolePositionsDegrees
    | CzmlPositionDegrees
    | undefined;
  if (
    hierPos &&
    "cartographicDegrees" in hierPos &&
    hierPos.cartographicDegrees?.length >= 6
  )
    return {
      outer: flatToRingDegrees(hierPos.cartographicDegrees),
      holes: extractHolesDegrees(hier?.holes),
    };

  // 3) polygon.hierarchy.cartographicDegrees
  if (hier?.cartographicDegrees && hier.cartographicDegrees.length >= 6)
    return {
      outer: flatToRingDegrees(hier.cartographicDegrees),
      holes: extractHolesDegrees(hier?.holes),
    };

  return null;
}

function isNumberArray(x: unknown): x is number[] {
  return Array.isArray(x) && x.every((v) => typeof v === "number");
}

function isNumberArrayArray(x: unknown): x is number[][] {
  return Array.isArray(x) && x.every(isNumberArray);
}

function extractHolesDegrees(holesObj: unknown): Position[][] {
  const holes: Position[][] = [];
  if (!holesObj || typeof holesObj !== "object") return holes;

  // A) holes.cartographicDegrees as number[] | number[][]
  if (
    "cartographicDegrees" in (holesObj as { cartographicDegrees?: unknown }) &&
    isNumberArray(
      (holesObj as { cartographicDegrees?: unknown }).cartographicDegrees,
    )
  ) {
    holes.push(
      flatToRingDegrees(
        (holesObj as { cartographicDegrees: number[] }).cartographicDegrees,
      ),
    );
    return holes;
  }
  if (
    "cartographicDegrees" in (holesObj as { cartographicDegrees?: unknown }) &&
    isNumberArrayArray(
      (holesObj as { cartographicDegrees?: unknown }).cartographicDegrees,
    )
  ) {
    for (const arr of (holesObj as { cartographicDegrees: number[][] })
      .cartographicDegrees) {
      holes.push(flatToRingDegrees(arr));
    }
    return holes;
  }

  // B) holes as array of { positions: { cartographicDegrees: number[] } }
  const holesList = (holesObj as { holes?: unknown }).holes;
  if (Array.isArray(holesList)) {
    for (const h of holesList) {
      if (h && typeof h === "object") {
        const hp = (h as { positions?: { cartographicDegrees?: unknown } })
          .positions;
        const arr = hp?.cartographicDegrees;
        if (isNumberArray(arr)) holes.push(flatToRingDegrees(arr));
      }
    }
  }
  return holes;
}

function parseISO(iso: string) {
  return new Date(iso);
}

function coordFromPosition(
  posObj: CzmlPositionDegrees | undefined,
): Position | null {
  if (!posObj) return null;
  const d = posObj.cartographicDegrees;
  if (!Array.isArray(d) || d.length < 3) return null;

  // Static [lon,lat,height]
  if (d.length === 3 && typeof d[0] === "number")
    return [d[0], d[1], d[2] ?? 0];

  // TODO: Interpolate coordinate based on time
  if (d.length >= 4) {
    return [d[1], d[2], d[3] ?? 0];
  }

  return null;
}

function extractPixelSize(pkt: CzmlPacket): number | null {
  const ps = pkt.point?.pixelSize;
  return typeof ps === "number" ? ps : null;
}

/**
 * Converts CZML array to GeoJSON FeatureCollection.
 * Each CZML packet becomes a single GeoJSON feature with availability information.
 */
export function czmlToGeoJSON(czmlArray: CzmlPacket[]): GeoJSONFC {
  const features: GeoJSONFeature[] = [];
  let minTime: string | null = null;
  let maxTime: string | null = null;

  for (const pkt of czmlArray || []) {
    if (!pkt) continue;

    // Parse availability intervals for this packet
    const avs = expandAvailability(pkt.availability);
    const availabilities = avs.map((iv) => {
      const [start, end] = iv.split("/");
      // Track min/max time
      if (!minTime || start < minTime) minTime = start;
      if (!maxTime || end > maxTime) maxTime = end;
      return { start, end };
    });

    // Polygon
    if (pkt.polygon) {
      const coords = polygonCoordsFromCzml(pkt.polygon);
      if (coords?.outer?.length && coords.outer.length >= 4) {
        const rgba =
          pkt.polygon.material?.solidColor?.color?.rgba ??
          pkt.polygon.material?.color?.rgba ??
          undefined;
        const props: FeatureProperties = {
          czml_id: pkt.id ?? null,
          name: pkt.name ?? null,
          availabilities,
          perPositionHeight: !!pkt.polygon.perPositionHeight,
          kind: "polygon",
        };
        if (Array.isArray(rgba) && rgba.length >= 3)
          props.color = rgba.slice(0, 4);
        features.push({
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: coords.holes?.length
              ? [coords.outer, ...coords.holes]
              : [coords.outer],
          },
          properties: props,
        });
      }
    }

    // Point / Billboard
    if ((pkt.point || pkt.billboard) && pkt.position) {
      const px = extractPixelSize(pkt) ?? (pkt.billboard ? 12 : null);
      const coord = coordFromPosition(pkt.position);
      if (!coord) continue;
      const rgba =
        pkt.point?.color?.rgba ??
        pkt.point?.outlineColor?.rgba ??
        pkt.billboard?.color?.rgba ??
        undefined;
      const props: FeatureProperties = {
        czml_id: pkt.id ?? null,
        name: pkt.name ?? null,
        availabilities,
        pixelSize: px,
        kind: "point",
      };
      if (Array.isArray(rgba) && rgba.length >= 3)
        props.color = rgba.slice(0, 4);
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: coord },
        properties: props,
      });
    }
  }

  return {
    type: "FeatureCollection",
    features,
    timeSpan: minTime && maxTime ? { start: minTime, end: maxTime } : null,
  };
}

/**
 * Checks if a feature is available at a given time.
 * @param feature - GeoJSON feature with availability information
 * @param time - ISO 8601 time string to check
 * @returns true if the feature is available at the given time
 */
export function isFeatureAvailableAt(
  feature: GeoJSONFeature,
  time: string,
): boolean {
  const availabilities = feature.properties?.availabilities;
  if (!availabilities || availabilities.length === 0) return true;

  const timeDate = parseISO(time);
  return availabilities.some((av) => {
    const start = parseISO(av.start);
    const end = parseISO(av.end);
    return timeDate >= start && timeDate < end;
  });
}
