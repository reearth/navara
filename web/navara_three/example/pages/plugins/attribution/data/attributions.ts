import type { AttributionItem } from "@navara/three_plugins";

/**
 * Data-source attribution table for the attribution example.
 *
 * The GSI "seamless photo" tile composites different imagery depending on zoom
 * (per the GSI tile list — https://maps.gsi.go.jp/development/ichiran.html), so
 * its credits are banded by zoom. The plugin filters `children` by the current
 * camera zoom (Phase 3); until then all bands are shown together.
 *
 * `children[].title` may contain partial `<a>` links — they are sanitized and
 * rendered as anchors by the plugin. Bare `http(s)` URLs are auto-linked too,
 * so an official notice can be pasted verbatim without hand-wrapping its URL.
 */
export const GSI_ATTRIBUTION: AttributionItem = {
  attribution: "国土地理院",
  url: "https://maps.gsi.go.jp/development/ichiran.html",
  children: [
    // z14-18: 全国最新写真（シームレス）
    { title: "全国最新写真（シームレス）", minZoom: 14, maxZoom: 18 },
    { title: "GRUS画像（© Axelspace）", minZoom: 14, maxZoom: 18 },
    // z9-13: 全国ランドサットモザイク画像
    { title: "全国ランドサットモザイク画像", minZoom: 9, maxZoom: 13 },
    {
      // Pasted verbatim from the GSI tile list (note: no spaces after the
      // commas inside the first parens — do not "tidy" them).
      title:
        "データソース：Landsat8画像（GSI,TSIC,GEO Grid/AIST）, Landsat8画像（courtesy of the U.S. Geological Survey）, 海底地形（GEBCO）",
      minZoom: 9,
      maxZoom: 13,
    },
    // z2-8: 世界衛星モザイク画像
    { title: "世界衛星モザイク画像", minZoom: 2, maxZoom: 8 },
    {
      // Pasted verbatim from the GSI tile list; the bare URL is auto-linked.
      title:
        "Images on 世界衛星モザイク画像 obtained from site https://lpdaac.usgs.gov/data_access maintained by the NASA Land Processes Distributed Active Archive Center (LP DAAC), USGS/Earth Resources Observation and Science (EROS) Center, Sioux Falls, South Dakota, (Year). Source of image data product.",
      minZoom: 2,
      maxZoom: 8,
    },

    // --- 電子地形図（タイル）/ English（seamlessphoto とは別製品）---
    // z9-11: 1:1,000,000 International Map
    {
      title:
        "1:1,000,000 International Map（電子地形図（タイル）/ Geospatial Information Authority of Japan (GSI)）",
      minZoom: 9,
      maxZoom: 11,
    },
    // z5-8: Japan And Its Surroundings。標準の出所明示に加え、以下の出所も
    // 合わせて明示する掲出義務がある（GSI タイル一覧の備考より）。
    {
      title:
        "Japan And Its Surroundings（電子地形図（タイル）/ Geospatial Information Authority of Japan (GSI)）",
      minZoom: 5,
      maxZoom: 8,
    },
    {
      title:
        "The bathymetric contours are derived from those contained within the GEBCO Digital Atlas, published by the BODC on behalf of IOC and IHO (2003) (https://www.gebco.net) 海上保安庁許可第292502号（水路業務法第25条に基づく類似刊行物）",
      minZoom: 5,
      maxZoom: 8,
    },
    {
      title:
        'Shoreline data is derived from: United States. National Imagery and Mapping Agency. "Vector Map Level 0 (VMAP0)." Bethesda, MD: Denver, CO: The Agency; USGS Information Services, 1997.',
      minZoom: 5,
      maxZoom: 8,
    },
  ],
};

/** Sentinel-2 cloudless, demonstrating a raw HTML credit with multiple links. */
export const SENTINEL_ATTRIBUTION: AttributionItem = {
  attributionHtml:
    '<a href="https://s2maps.eu">Sentinel-2 cloudless 2020</a> by <a href="https://eox.at">EOX IT Services GmbH</a> (contains modified Copernicus Sentinel data 2020)',
};
