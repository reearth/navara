import {
  type LayerDescription,
  type TilesLayer,
  JAPAN_GSI_ELEVATION_DECODER,
  Layer as NavaraLayer,
} from "@navara/three";
import { Layer, useViewContext } from "@navara/three_react";
import { useMemo, useState, type FC } from "react";

import {
  TILE_DATASETS,
  TERRAIN_DATASETS,
  TILES_3D_DATASETS,
  LOCAL_DATASETS,
} from "../../helpers/constants";

import { useCloudOverlayOpacity, useDefaultLayers } from "./hooks";

export const Layers: FC = () => {
  const { view } = useViewContext();

  const defaultLayers = useDefaultLayers(view);

  // Descriptions
  const baseTiles = useMemo<LayerDescription>(
    () => ({
      type: "tiles",
      data: { url: TILE_DATASETS.gsiSeamlessphoto.url },
      raster_tile: { min_zoom: 2, max_zoom: 18 },
    }),
    [],
  );

  const terrain = useMemo<LayerDescription>(
    () => ({
      type: "terrain",
      data: { url: TERRAIN_DATASETS.gsi.url },
      raster_terrain: {
        min_zoom: 6,
        max_zoom: 15,
        elevation_decoder: JAPAN_GSI_ELEVATION_DECODER(),
        cast_shadow: true,
        receive_shadow: true,
      },
    }),
    [],
  );

  const chiyoda3d = useMemo<LayerDescription>(
    () => ({
      type: "cesium3dtiles",
      data: {
        url: TILES_3D_DATASETS.plateauChiyoda.url,
      },
      model: {
        show: true,
        color: 0xffffff,
        metalness: 0,
        roughness: 1,
        cast_shadow: true,
        receive_shadow: true,
        height: -50,
      },
    }),
    [],
  );

  const chuo3d = useMemo<LayerDescription>(
    () => ({
      type: "cesium3dtiles",
      data: {
        url: TILES_3D_DATASETS.plateauChuo.url,
      },
      model: {
        show: true,
        color: 0xffffff,
        metalness: 0,
        roughness: 1,
        cast_shadow: true,
        receive_shadow: true,
        height: -50,
      },
    }),
    [],
  );

  const cloudsOverlayDesc = useMemo<TilesLayer>(
    () => ({
      type: "tiles",
      data: { url: LOCAL_DATASETS.blueMarbleClouds.url },
      raster_tile: { min_zoom: 2, max_zoom: 6, opacity: 1 },
    }),
    [],
  );

  const [cloudsHandle, setCloudsHandle] = useState<NavaraLayer | null>(null);
  useCloudOverlayOpacity(view, cloudsHandle, cloudsOverlayDesc);

  const cloudsEffect = useMemo<LayerDescription>(
    () => ({
      type: "effect",
      clouds: {},
    }),
    [],
  );

  return (
    <>
      <Layer config={baseTiles} />
      <Layer config={terrain} />
      <Layer config={chiyoda3d} />
      <Layer config={chuo3d} />
      <Layer<NavaraLayer>
        config={cloudsOverlayDesc}
        onReady={setCloudsHandle}
      />
      {defaultLayers && <Layer config={cloudsEffect} />}
    </>
  );
};
