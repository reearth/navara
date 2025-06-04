import { geodeticToXyz } from "@navara/engine-api";

export function geodeticToVector3(lng: number, lat: number, height: number) {
  return geodeticToXyz(new Float32Array([lng, lat, height]));
}
