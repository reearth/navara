## USAGE

This example uses [NASA Blue Marble Clouds image](https://www.visibleearth.nasa.gov/images/57747/blue-marble-clouds) as XYZ tiles. You need to set the tiles at `example/public/data/blue-marble-clouds`, and it have to be accessible as `/data/blue-marble-clouds/{z}/{x}/{y}.webp`.

**NOTE**: You should check [NASA Image Use Policy](https://www.visibleearth.nasa.gov/image-use-policy) before using it in your product.

1. Download [Blue Marble Clouds](https://www.visibleearth.nasa.gov/images/57747/blue-marble-clouds) provided by NASA.
2. Transparent black background in ImageMagick.

```bash
magick blue-marble-clouds.tif \
  -colorspace gray \
  -alpha copy \
  -channel RGB -evaluate set 100% \
  clouds-alpha.tif

magick clouds-alpha.tif \
  -define colorspace:auto-grayscale=false \
  -type TrueColorAlpha \
  clouds-alpha.tif
```

3. Transform Tiff to GeoTiff

```bash
gdal_translate -of GTiff \
  -a_ullr -180 90 180 -90 \
  -a_srs EPSG:4326 \
  clouds-alpha.tif \
  clouds-georef.tif
```

4. Generate XYZ tiles

```bash
gdal2tiles.py -p mercator -z 0-6 --xyz \
  --tiledriver=WEBP \
  --webp-quality=85 \
  --webp-lossless \
  clouds-georef.tif blue-marble-clouds/
```
