import initApi, {
  geodeticToXyz,
  xyzToGeodetic,
  angleToRadian,
  angleToDegree,
  LLE,
  Vec3,
} from "@navara/engine-api";
import { Vector3 } from "three";

export async function initNavaraApi() {
  await initApi();
}

export function geodeticToVector3(
  lng: number,
  lat: number,
  height: number,
): Vector3 {
  const pos = geodeticToXyz(new LLE(lat, lng, height));
  return new Vector3(pos.x, pos.y, pos.z);
}

export function vector3ToGeodetic(xyz: Vector3): LLE {
  const vec3 = new Vec3(xyz.x, xyz.y, xyz.z);
  return xyzToGeodetic(vec3);
}

export function degreeToRadian(degree: number): number {
  return angleToRadian(degree);
}

export function radianToDegree(radian: number): number {
  return angleToDegree(radian);
}
