import type ThreeView from "@navaramap/three";
import { Color, type PickedFeature } from "@navaramap/three";
import type { BoxMeshDesc } from "@navaramap/three-default-descs";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import type { FeatureCollection } from "geojson";
import { Pane } from "tweakpane";

import { TILE_DATASETS } from "../../../helpers/constants";

export type CustomDescriptions = DefaultDescriptions;

const BASE = "#0091ff";
const HIGHLIGHT = "#ff6b2c";

// Draped polygons (clampToGround) hover-pick through the tile drape atlas;
// extruded polygons and points hover-pick as regular pickable meshes.
const drapedPolygons: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Odaiba" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [139.766, 35.622],
            [139.784, 35.622],
            [139.784, 35.632],
            [139.766, 35.632],
            [139.766, 35.622],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Aomi" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [139.786, 35.615],
            [139.8, 35.615],
            [139.8, 35.625],
            [139.786, 35.625],
            [139.786, 35.615],
          ],
        ],
      },
    },
  ],
};

const extrudedPolygons: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Toyosu Block" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [139.792, 35.645],
            [139.8, 35.645],
            [139.8, 35.651],
            [139.792, 35.651],
            [139.792, 35.645],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Harumi Block" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [139.776, 35.65],
            [139.784, 35.65],
            [139.784, 35.656],
            [139.776, 35.656],
            [139.776, 35.65],
          ],
        ],
      },
    },
  ],
};

const points: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Shibaura Point" },
      geometry: { type: "Point", coordinates: [139.755, 35.64] },
    },
    {
      type: "Feature",
      properties: { name: "Shinagawa Point" },
      geometry: { type: "Point", coordinates: [139.747, 35.625] },
    },
  ],
};

export const run = async (view: ThreeView<CustomDescriptions>) => {
  const defaultPlugin = new DefaultPlugin();
  view.addPlugin(defaultPlugin);
  const attribution = view.attribution;

  await view.init();

  // Extruded polygons and the box mesh are lit; draped/point content ignores lights.
  view.addLight({ ambient: { intensity: 0.8 } });
  view.addLight({ sun: { intensity: 1.5 } });
  view.atmosphere.date = new Date("2024-06-21T03:00:00Z");

  view.setCamera({
    lng: 139.777,
    lat: 35.585,
    height: 5500,
    heading: 0,
    pitch: -40,
    roll: 0,
  });

  const osmSource = view.addSource({
    type: "raster-tile",
    url: TILE_DATASETS.openstreetmap.url,
    maxZoom: 18,
  });
  view.addLayer({ type: "raster", source: osmSource });

  const drapedSource = view.addSource({
    type: "geojson",
    data: drapedPolygons,
  });
  const drapedLayer = view.addLayer({
    type: "vector",
    source: drapedSource,
    polygon: {
      color: new Color().setStyle(BASE),
      clampToGround: true,
      opacity: 0.6,
    },
  });

  const extrudedSource = view.addSource({
    type: "geojson",
    data: extrudedPolygons,
  });
  const extrudedLayer = view.addLayer({
    type: "vector",
    source: extrudedSource,
    polygon: {
      color: new Color().setStyle(BASE),
      clampToGround: false,
      extrudedHeight: 500,
    },
  });

  const pointSource = view.addSource({ type: "geojson", data: points });
  const pointLayer = view.addLayer({
    type: "vector",
    source: pointSource,
    point: {
      color: new Color().setStyle(BASE),
      size: 20,
      sizeInMeters: false,
    },
  });

  const boxLayer = view.addMesh<BoxMeshDesc>({
    pickable: true,
    box: {
      width: 600,
      height: 800,
      depth: 600,
      color: new Color().setStyle(BASE),
    },
    geodetic: { lng: 139.759, lat: 35.655, height: 400 },
  });

  const layerNames = new Map<string, string>([
    [drapedLayer.id, "draped-polygon"],
    [extrudedLayer.id, "extruded-polygon"],
    [pointLayer.id, "point"],
  ]);

  // Hover highlight state: vector features restyle via their evaluator on
  // forceUpdate; the box mesh restyles via handle.update.
  let hoveredName: string | null = null;

  const highlightByName = (layer: typeof drapedLayer) => {
    layer.on("featureUpdated", ({ evaluator }) => {
      evaluator.evaluate(
        ({ properties }) => ({
          color: new Color().setStyle(
            properties?.["name"] === hoveredName ? HIGHLIGHT : BASE,
          ),
        }),
        { filters: ["name"] },
      );
    });
  };
  highlightByName(drapedLayer);
  highlightByName(extrudedLayer);
  highlightByName(pointLayer);

  const pane = new Pane({ title: "Picking Layers" });
  const info = {
    hovered: "(none)",
    layer: "(none)",
    batchId: 0,
    enterCount: 0,
    leaveCount: 0,
    clicked: "(none)",
    hoverEnabled: true,
  };
  const hoverFolder = pane.addFolder({ title: "Hover" });
  const bindings = [
    hoverFolder.addBinding(info, "hovered", { readonly: true }),
    hoverFolder.addBinding(info, "layer", { readonly: true }),
    hoverFolder.addBinding(info, "batchId", { readonly: true }),
    hoverFolder.addBinding(info, "enterCount", { readonly: true }),
    hoverFolder.addBinding(info, "leaveCount", { readonly: true }),
    pane.addBinding(info, "clicked", { readonly: true }),
  ];
  const refresh = () => bindings.forEach((b) => b.refresh());

  const featureName = (feature: PickedFeature): string =>
    (feature.properties?.["name"] as string | undefined) ??
    (feature.batchId === boxLayer.ref.batchId
      ? "Box Mesh"
      : `batch ${feature.batchId}`);

  const applyHoverStyle = (feature: PickedFeature | null | undefined) => {
    hoveredName = feature ? featureName(feature) : null;
    drapedLayer.forceUpdate();
    extrudedLayer.forceUpdate();
    pointLayer.forceUpdate();
    boxLayer.update({
      box: {
        color: new Color().setStyle(
          feature?.batchId === boxLayer.ref.batchId ? HIGHLIGHT : BASE,
        ),
      },
    });
  };

  const onHover = (feature: PickedFeature | null | undefined) => {
    info.hovered = feature ? featureName(feature) : "(none)";
    info.layer = feature
      ? (layerNames.get(feature.layerId ?? "") ??
        (feature.batchId === boxLayer.ref.batchId ? "box-mesh" : "(unknown)"))
      : "(none)";
    info.batchId = feature?.batchId ?? 0;
    view.canvas.style.cursor = feature ? "pointer" : "";
    applyHoverStyle(feature);
    refresh();
  };
  const onEnter = () => {
    info.enterCount += 1;
    refresh();
  };
  const onLeave = () => {
    info.leaveCount += 1;
    refresh();
  };

  const attachHover = () => {
    view.on("featureHover", onHover);
    view.on("featureEnter", onEnter);
    view.on("featureLeave", onLeave);
  };
  const detachHover = () => {
    view.off("featureHover", onHover);
    view.off("featureEnter", onEnter);
    view.off("featureLeave", onLeave);
    onHover(null);
  };
  attachHover();

  // Hover picking is lazily gated on listener registration — toggling this
  // off must stop all hover pick renders.
  pane
    .addBinding(info, "hoverEnabled")
    .on("change", (ev) => (ev.value ? attachHover() : detachHover()));

  view.on("featureClick", (feature) => {
    info.clicked = feature ? featureName(feature) : "(none)";
    refresh();
  });

  attribution?.add([TILE_DATASETS.openstreetmap]);
};
