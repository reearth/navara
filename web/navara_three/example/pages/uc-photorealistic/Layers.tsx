import {
  type LayerDescription,
  type TilesLayer,
  JAPAN_GSI_ELEVATION_DECODER,
  Layer as NavaraLayer,
} from "@navara/three";
import { Layer, useViewContext } from "@navara/three_react";
import { useMemo, useState, type FC } from "react";

import { TILE_URLS, TERRAIN_URLS } from "../../helpers/constants";

import { useCloudOverlayOpacity, useDefaultLayers } from "./hooks";

export const Layers: FC = () => {
  const { view } = useViewContext();

  const defaultLayers = useDefaultLayers(view);

  // Descriptions
  const baseTiles = useMemo<LayerDescription>(
    () => ({
      type: "tiles",
      data: { url: TILE_URLS.gsiSeamlessphoto },
      raster_tile: { min_zoom: 2, max_zoom: 18 },
    }),
    [],
  );

  const terrain = useMemo<LayerDescription>(
    () => ({
      type: "terrain",
      data: { url: TERRAIN_URLS.gsi },
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
        url: "https://assets.cms.plateau.reearth.io/assets/db/070026-aa27-431b-8d53-7cc6b03244f8/13101_chiyoda-ku_pref_2023_citygml_1_op_bldg_3dtiles_13101_chiyoda-ku_lod2_no_texture/tileset.json",
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
        url: "https://assets.cms.plateau.reearth.io/assets/4c/f2436a-e2be-40e2-83da-f1781f36e30b/13102_chuo-ku_pref_2023_citygml_1_op_bldg_3dtiles_13102_chuo-ku_lod2_no_texture/tileset.json",
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
      data: { url: "/data/blue-marble-clouds/{z}/{x}/{y}.webp" },
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
