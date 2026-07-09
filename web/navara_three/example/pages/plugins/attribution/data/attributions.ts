import type { AttributionItem } from "@navara/three_plugins";

/**
 * Data-source attribution table for the attribution example.
 *
 * The GSI "seamless photo" tile composites different imagery depending on zoom
 * (per the GSI tile list — https://maps.gsi.go.jp/development/ichiran.html), so
 * its credits are banded by zoom. The plugin filters `children` by the current
 * camera zoom, so only the bands for the current zoom level are shown.
 *
 * `children[].attribution` may contain partial `<a>` links (sanitized) and bare
 * `http(s)` URLs are auto-linked, so an official notice can be pasted verbatim.
 * Data-source names are translated to English; GSI-mandated source notices are
 * kept verbatim.
 */
export const GSI_ATTRIBUTION: AttributionItem = {
  attribution: "Geospatial Information Authority of Japan (GSI)",
  attributionUrl: "https://maps.gsi.go.jp/development/ichiran.html",
  children: [
    // z14-18: latest seamless aerial photo
    {
      attribution: "Nationwide latest aerial photos (seamless)",
      minZoom: 14,
      maxZoom: 18,
    },
    // GSI mandates this exact notice when GRUS tiles are included — verbatim.
    { attribution: "GRUS画像（© Axelspace）", minZoom: 14, maxZoom: 18 },
    // z9-13: nationwide Landsat mosaic
    {
      attribution: "Nationwide Landsat mosaic imagery",
      minZoom: 9,
      maxZoom: 13,
    },
    {
      // Pasted verbatim from the GSI tile list (note: no spaces after the
      // commas inside the first parens — do not "tidy" them).
      attribution:
        "データソース：Landsat8画像（GSI,TSIC,GEO Grid/AIST）, Landsat8画像（courtesy of the U.S. Geological Survey）, 海底地形（GEBCO）",
      minZoom: 9,
      maxZoom: 13,
    },
    // z2-8: global satellite mosaic
    {
      attribution: "Global satellite mosaic imagery",
      minZoom: 2,
      maxZoom: 8,
    },
    {
      // Pasted verbatim from the GSI tile list; the bare URL is auto-linked.
      attribution:
        "Images on 世界衛星モザイク画像 obtained from site https://lpdaac.usgs.gov/data_access maintained by the NASA Land Processes Distributed Active Archive Center (LP DAAC), USGS/Earth Resources Observation and Science (EROS) Center, Sioux Falls, South Dakota, (Year). Source of image data product.",
      minZoom: 2,
      maxZoom: 8,
    },

    // Electronic topographic map (tiles) — a separate product from seamlessphoto.
    {
      attribution:
        "1:1,000,000 International Map (Electronic topographic map (tiles) / Geospatial Information Authority of Japan (GSI))",
      minZoom: 9,
      maxZoom: 11,
    },
    // z5-8: Japan And Its Surroundings. Beyond the standard source credit, the
    // notices below must also be shown (per the notes in the GSI tile list).
    {
      attribution:
        "Japan And Its Surroundings (Electronic topographic map (tiles) / Geospatial Information Authority of Japan (GSI))",
      minZoom: 5,
      maxZoom: 8,
    },
    {
      attribution:
        "The bathymetric contours are derived from those contained within the GEBCO Digital Atlas, published by the BODC on behalf of IOC and IHO (2003) (https://www.gebco.net) 海上保安庁許可第292502号（水路業務法第25条に基づく類似刊行物）",
      minZoom: 5,
      maxZoom: 8,
    },
    {
      attribution:
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
