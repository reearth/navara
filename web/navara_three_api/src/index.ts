import { geodeticToXyz, LLE } from "@navara/engine-api";
import { Vector3 } from "three";

export function geodeticToVector3(lng: number, lat: number, height: number) {
  const pos = geodeticToXyz(new LLE(lng, lat, height));
  return new Vector3(pos[0], pos[1], pos[2]);
}
