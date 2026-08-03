import {
  type LayerDescription,
  Color,
  JAPAN_GSI_ELEVATION_DECODER,
} from "@navaramap/three";
import type { CloudsConfig } from "@navaramap/three-default-descs";
import type { DefaultPlugin } from "@navaramap/three-default-plugin";
import { EffectDesc, Layer, useViewContext } from "@navaramap/three-react";
import { useEffect, useMemo, type FC } from "react";

import { useDefaultLayers } from "./hooks";

export const Layers: FC<{ defaultPlugin: DefaultPlugin }> = ({
  defaultPlugin,
}) => {
  const { view } = useViewContext();

  const defaultLayers = useDefaultLayers(view, defaultPlugin);

  // Sources — created once, deleted on unmount (child layers release the
  // refcount first, so the source deletes cleanly).
  const baseTilesSource = useMemo(
    () =>
      view.addSource({
        type: "raster-tile",
        url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
        minZoom: 2,
        maxZoom: 18,
      }),
    [view],
  );
  const demSource = useMemo(
    () =>
      view.addSource({
        type: "raster-dem",
        url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png",
        elevationDecoder: JAPAN_GSI_ELEVATION_DECODER(),
        minZoom: 6,
        maxZoom: 15,
      }),
    [view],
  );
  const chiyodaSource = useMemo(
    () =>
      view.addSource({
        type: "3d-tiles",
        url: "https://assets.cms.plateau.reearth.io/assets/db/070026-aa27-431b-8d53-7cc6b03244f8/13101_chiyoda-ku_pref_2023_citygml_1_op_bldg_3dtiles_13101_chiyoda-ku_lod2_no_texture/tileset.json",
      }),
    [view],
  );
  const chuoSource = useMemo(
    () =>
      view.addSource({
        type: "3d-tiles",
        url: "https://assets.cms.plateau.reearth.io/assets/4c/f2436a-e2be-40e2-83da-f1781f36e30b/13102_chuo-ku_pref_2023_citygml_1_op_bldg_3dtiles_13102_chuo-ku_lod2_no_texture/tileset.json",
      }),
    [view],
  );
  useEffect(
    () => () => {
      baseTilesSource.delete();
      demSource.delete();
      chiyodaSource.delete();
      chuoSource.delete();
    },
    [baseTilesSource, demSource, chiyodaSource, chuoSource],
  );

  // Descriptions
  const baseTiles = useMemo<LayerDescription>(
    () => ({
      type: "raster",
      source: baseTilesSource,
    }),
    [baseTilesSource],
  );

  const terrain = useMemo<LayerDescription>(
    () => ({
      type: "terrain",
      source: demSource,
      terrain: {
        castShadow: true,
        receiveShadow: true,
      },
    }),
    [demSource],
  );

  const chiyoda3d = useMemo<LayerDescription>(
    () => ({
      type: "3d-tiles",
      source: chiyodaSource,
      model: {
        show: true,
        color: new Color().setHex(0xffffff),
        metalness: 0,
        roughness: 1,
        castShadow: true,
        receiveShadow: true,
        height: -50,
      },
    }),
    [chiyodaSource],
  );

  const chuo3d = useMemo<LayerDescription>(
    () => ({
      type: "3d-tiles",
      source: chuoSource,
      model: {
        show: true,
        color: new Color().setHex(0xffffff),
        metalness: 0,
        roughness: 1,
        castShadow: true,
        receiveShadow: true,
        height: -50,
      },
    }),
    [chuoSource],
  );

  const cloudsEffect = useMemo(
    (): CloudsConfig => ({
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
      {defaultLayers && <EffectDesc config={cloudsEffect} />}
    </>
  );
};
