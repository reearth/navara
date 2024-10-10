import { VectorTile } from "@mapbox/vector-tile";
import { Ellipsoid } from "@math.gl/geospatial";
import earcut from "earcut";
import { type Feature } from "geojson";
import Pbf from "pbf";
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
} from "three";
import { BufferGeometryUtils } from "three/examples/jsm/Addons.js";

import { type Extent, forEachTilesAsync, getTileUrl } from "./utils";

export type MVTOptions = {
  url: string;
  zoom: number;
  height?: number;
  layers: string[];
  extent?: Extent;
  color?: number;
};

export default class MVT {
  node = new Group();
  url: string;
  zoom: number;
  layers: string[];
  extent?: Extent;
  height?: number;
  color?: number;
  material: MeshBasicMaterial;

  constructor({ url, zoom, layers, extent, height, color }: MVTOptions) {
    this.url = url;
    this.zoom = zoom;
    this.layers = layers;
    this.extent = extent;
    this.height = height;
    this.color = color;
    this.material = new MeshBasicMaterial({ color: color ?? 0xffffff });

    forEachTilesAsync(
      zoom,
      (x, y, z) => {
        return this.loadTile(url, x, y, z, this.layers);
      },
      {
        extent: this.extent,
      },
    );
  }

  loadTile(url: string, x: number, y: number, z: number, layers: string[]) {
    const actualUrl = getTileUrl(url, x, y, z);
    fetch(actualUrl)
      .then((response) => {
        if (!response.ok) return;
        return response.arrayBuffer();
      })
      .then((arrayBuffer) => {
        if (!arrayBuffer) return;
        const meshes = createMeshes(
          arrayBuffer,
          x,
          y,
          z,
          layers,
          this.material,
          this.height,
        );
        for (const mesh of meshes) {
          this.node.add(mesh);
        }
      });
  }
}

function createMeshes(
  arrayBuffer: ArrayBuffer,
  x: number,
  y: number,
  z: number,
  layers: string[],
  material: MeshBasicMaterial,
  height?: number,
): Mesh[] {
  const res: Mesh[] = [];
  const geojsons = getGeojsons(arrayBuffer, x, y, z, layers);
  const geometries: BufferGeometry[] = [];

  for (const layerName of layers) {
    const features = geojsons.get(layerName);
    if (!features) continue;

    for (const feature of features) {
      if (!feature.geometry) continue;
      const geometry = computeGeometry(feature, height);
      if (geometry) geometries.push(geometry);
    }
  }

  const g = BufferGeometryUtils.mergeGeometries(geometries, true);
  const mesh = new Mesh(g, material);
  res.push(mesh);

  return res;
}

function getGeojsons(
  arrayBuffer: ArrayBuffer,
  x: number,
  y: number,
  z: number,
  layers: string[],
): Map<string, Feature[]> {
  const map = new Map<string, Feature[]>();
  const vt = new VectorTile(new Pbf(arrayBuffer));

  for (const layerName of layers) {
    const layer = vt.layers[layerName];
    if (!layer) continue;

    map.set(layerName, []);
    for (let i = 0; i < layer.length; i++) {
      const feature = layer.feature(i);
      const geojson = feature.toGeoJSON(x, y, z);
      const features = map.get(layerName);
      if (features) {
        features.push(geojson);
        map.set(layerName, features);
      }
    }
  }

  return map;
}

export function computeGeometry(
  feature: Feature,
  height = 0,
  geometry = new BufferGeometry(),
): BufferGeometry | undefined {
  if (feature.geometry.type === "Polygon") {
    const coordinates = feature.geometry.coordinates.map((ring) =>
      ring.map((p) => (p.length === 2 ? [...p, height] : p.slice(0, 3))),
    );
    const data = earcut.flatten(coordinates);
    // data.dimensions should be always 3
    const triangles = earcut(data.vertices, data.holes, data.dimensions);
    const res = { vertices: data.vertices, indices: triangles };

    const vertices = new Float32Array((res.vertices.length / 3) * 3);
    for (let i = 0; i < res.vertices.length / 3; i++) {
      const lng = res.vertices[i * 3];
      const lat = res.vertices[i * 3 + 1];
      const height = res.vertices[i * 3 + 2];
      const pos = Ellipsoid.WGS84.cartographicToCartesian([lng, lat, height]);
      vertices[i * 3] = pos[0];
      vertices[i * 3 + 1] = pos[1];
      vertices[i * 3 + 2] = pos[2];
    }

    const indices = Uint32Array.from(res.indices);

    geometry.setAttribute("position", new BufferAttribute(vertices, 3));
    geometry.setIndex(new BufferAttribute(indices, 1));
    geometry.computeVertexNormals();
    return geometry;
  }

  return;
}
