import type { FeatureCollection } from "geojson";

/**
 * The world's oceans and a few major seas as labeled points. Each feature
 * carries a `name` property that the text layer renders at the point.
 */
export const oceans: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    { name: "Arctic Ocean", lng: -30, lat: 78 },
    { name: "North Atlantic Ocean", lng: -40, lat: 30 },
    { name: "South Atlantic Ocean", lng: -18, lat: -28 },
    { name: "Indian Ocean", lng: 72, lat: -18 },
    { name: "Southern Ocean", lng: -20, lat: -62 },
    { name: "North Pacific Ocean", lng: -165, lat: 30 },
    { name: "South Pacific Ocean", lng: -125, lat: -30 },
    { name: "Caribbean Sea", lng: -75, lat: 15 },
    { name: "Mediterranean Sea", lng: 17, lat: 35 },
    { name: "Gulf of Guinea", lng: 1, lat: 0 },
  ].map(({ name, lng, lat }) => ({
    type: "Feature",
    properties: { name },
    geometry: { type: "Point", coordinates: [lng, lat] },
  })),
};
