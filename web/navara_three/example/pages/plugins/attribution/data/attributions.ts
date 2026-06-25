import type { AttributionItem } from "@navara/three_plugins";

/**
 * Data-source attribution table for the attribution example.
 *
 * The GSI "seamless photo" tile composites different imagery depending on zoom
 * (per the GSI tile list — https://maps.gsi.go.jp/development/ichiran.html), so
 * its data sources are banded by zoom. The plugin filters `children` by the
 * current camera zoom, so only the bands for the current zoom level are shown.
 *
 * Each child pairs a `dataSource` name (translated) with the GSI-mandated
 * `credits` (kept verbatim) shown nested beneath it. Bare URLs in a credit are
 * auto-linked, so an official notice can be pasted as-is.
 */

// GSI's electronic topographic map tiles share this source credit.
const GSI_TOPO_MAP_CREDIT =
  "Electronic topographic map (tiles) / Geospatial Information Authority of Japan (GSI)";

export const GSI_ATTRIBUTION: AttributionItem = {
  attribution: "Geospatial Information Authority of Japan (GSI)",
  url: "https://maps.gsi.go.jp/development/ichiran.html",
  children: [
    {
      dataSource: "Nationwide latest aerial photos (seamless)",
      // GSI mandates this exact notice when GRUS tiles are included — verbatim.
      credits: ["GRUS画像（© Axelspace）"],
      minZoom: 14,
      maxZoom: 18,
    },
    {
      dataSource: "Nationwide Landsat mosaic imagery",
      // Pasted verbatim from the GSI tile list (note: no spaces after the
      // commas inside the first parens — do not "tidy" them).
      credits: [
        "データソース：Landsat8画像（GSI,TSIC,GEO Grid/AIST）, Landsat8画像（courtesy of the U.S. Geological Survey）, 海底地形（GEBCO）",
      ],
      minZoom: 9,
      maxZoom: 13,
    },
    {
      dataSource: "Global satellite mosaic imagery",
      // Pasted verbatim from the GSI tile list; the bare URL is auto-linked.
      credits: [
        "Images on 世界衛星モザイク画像 obtained from site https://lpdaac.usgs.gov/data_access maintained by the NASA Land Processes Distributed Active Archive Center (LP DAAC), USGS/Earth Resources Observation and Science (EROS) Center, Sioux Falls, South Dakota, (Year). Source of image data product.",
      ],
      minZoom: 2,
      maxZoom: 8,
    },

    // Electronic topographic map (tiles) — a separate product from seamlessphoto.
    {
      dataSource: "1:1,000,000 International Map",
      credits: [GSI_TOPO_MAP_CREDIT],
      minZoom: 9,
      maxZoom: 11,
    },
    {
      // Beyond the standard source credit, the notices below must also be shown
      // (per the notes in the GSI tile list).
      dataSource: "Japan And Its Surroundings",
      credits: [
        GSI_TOPO_MAP_CREDIT,
        "The bathymetric contours are derived from those contained within the GEBCO Digital Atlas, published by the BODC on behalf of IOC and IHO (2003) (https://www.gebco.net) 海上保安庁許可第292502号（水路業務法第25条に基づく類似刊行物）",
        'Shoreline data is derived from: United States. National Imagery and Mapping Agency. "Vector Map Level 0 (VMAP0)." Bethesda, MD: Denver, CO: The Agency; USGS Information Services, 1997.',
      ],
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
