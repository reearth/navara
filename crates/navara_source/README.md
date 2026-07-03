# navara_source

Defines the `Source` concept: the origin and format of data consumed by one or
more layers (GeoJSON, vector tile, raster tile, raster DEM, quantized mesh,
ellipsoid, 3D Tiles / b3dm / pnts).

A `Source` owns everything required to fetch and decode data (URL, zoom range,
tiling scheme, decoder, inline data, ...). Rendering options live on the layer
side (`navara_layer`). A layer references a source by its engine-generated id,
and the engine deduplicates the underlying fetch/tiling resources so multiple
layers can share a single source.

The [`SourceStore`] resource keeps the relation between a source id, its spawned
source entity, and the number of layers referencing it.
