import initApi, { geodeticToXyz, LLE } from "@navara/engine-api";
import { Vector3 } from "three";

export async function initNavaraApi() {
  await initApi();
}

export function geodeticToVector3(lng: number, lat: number, height: number) {
  const pos = geodeticToXyz(new LLE(lng, lat, height));
  return new Vector3(pos.x, pos.y, pos.z);
}
