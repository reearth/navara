This example contains private data that isn't allowed re-distributing.

## Airport traffic volume data

You need to convert [Japan airport traffic volume data](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-S10b-2014.html) into GeoJSON, and put it on `navara/web/navara_three/example/public/data`, naming the file as `airport-traffic-volume.geojson`.

## Earth at Night imagery

You also need to set `/data/blue-marble-night/{z}/{x}/{y}.webp`. This is "Earth at Night" imagery provided by NASA.
You can create this data in the following steps.

1. Download "Global Map Downloads - 2016 Grayscale" from https://earthobservatory.nasa.gov/features/NightLights
2. Convert it to XYZ tiles and put it to `/data/blue-marble-night`.
   ```
    gdal2tiles.py -p mercator -z 0-6 --xyz \
        --tiledriver=WEBP \
        --webp-quality=85 \
        --webp-lossless \
        YOUR_IMAGE.tif tiles-webp/
   ```
