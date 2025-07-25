import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  overrideShaderMaterialForMRT,
} from "@navara/three";
import {
  degreeToRadian,
  eastNorthUpToFixedFrame,
  geodeticToVector3,
  LLE,
} from "@navara/three_api";
import {
  Color,
  ShaderLib,
  ShaderMaterial,
  UniformsUtils,
  Vector2,
  Vector3,
  type ShaderLibShader,
} from "three";
import { MarchingCubes, ToonShaderHatching } from "three-stdlib";

import type { CloudsEffectLayer } from "../../../src/layers/effect";
import { TERRAIN_URLS, TILE_URLS } from "../../helpers/constants";

export const run = async (view: ThreeView) => {
  await view.init();

  const defaultEffects = view.addDefaultEffectLayers();
  view.addDefaultAtmosphereLayers();

  // Add clouds effect layer explicitly
  const cloudsLayer = view.addLayer<CloudsEffectLayer>({
    type: "effect",
    clouds: {},
  });

  view.setCamera({
    lng: 139.8093261719,
    lat: 35.6374092102,
    height: 2526.03,
    heading: 310.9479980469, // -180 to 180
    pitch: -20.4675369263, // -180 to 0
    roll: 0.16, // -180 to 180
  });

  const date = new Date();
  date.setHours(8);

  view.atmosphere.date = date;

  defaultEffects.aerialPerspective.update({
    aerialPerspective: {
      irradiance: true,
    },
  });

  cloudsLayer.update({
    clouds: {
      shadows: true,
      localWeatherVelocity: new Vector2(0.005, 0.001),
      coverage: 0.3,
    },
  });

  view.toneMappingExposure = 10;

  view.addLayer({
    type: "tiles",
    data: { url: TILE_URLS.gsiSeamlessphoto },
    raster_tile: {
      max_zoom: 23,
    },
  });

  view.addLayer({
    type: "terrain",
    data: {
      url: TERRAIN_URLS.gsi,
    },
    raster_terrain: {
      max_zoom: 15,
      min_zoom: 5,
      elevation_decoder: JAPAN_GSI_ELEVATION_DECODER(),
    },
  });

  const hatchingMaterial = createShaderMaterial(
    ToonShaderHatching,
    new Color("#ffffff"),
    new Vector3(0.5, 0.5, 1),
    new Color("#ffffff"),
    new Color("#000"),
  );

  const cubes = new MarchingCubes(50, hatchingMaterial);

  const position = geodeticToVector3(
    new LLE(
      degreeToRadian(35.67564356091717),
      degreeToRadian(139.75711454748298),
      1000,
    ),
  );

  const matrix = eastNorthUpToFixedFrame(position);
  cubes.applyMatrix4(matrix);

  cubes.position.set(position.x, position.y, position.z);
  cubes.scale.set(1500, 1500, 1500);

  view.scenes.mrt.add(cubes);

  view.on("preUpdate", (t) => {
    updateCubes(cubes, t * 0.001, 10);
  });
};

// Ref: https://github.com/mrdoob/three.js/blob/master/examples/webgl_marchingcubes.html
function updateCubes(object: MarchingCubes, time: number, numblobs: number) {
  object.reset();

  const subtract = 12;
  const strength = 1.2 / ((Math.sqrt(numblobs) - 1) / 4 + 1);

  for (let i = 0; i < numblobs; i++) {
    const ballx =
      Math.sin(i + 1.26 * time * (1.03 + 0.5 * Math.cos(0.21 * i))) * 0.2 + 0.5;
    const bally =
      Math.abs(Math.cos(i + 1.12 * time * Math.cos(1.22 + 0.1424 * i))) * 0.3 +
      0.5;
    const ballz =
      Math.cos(i + 1.32 * time * 0.1 * Math.sin(0.92 + 0.53 * i)) * 0.2 + 0.5;

    object.addBall(ballx, bally, ballz, strength, subtract);
  }

  object.update();
}

function createShaderMaterial(
  shader: ShaderLibShader,
  color: Color,
  lightPosition: Vector3,
  lightColor: Color,
  ambientLightColor: Color,
) {
  const u = UniformsUtils.merge([
    UniformsUtils.clone(shader.uniforms),
    ShaderLib.depth.uniforms,
  ]);

  const vs = shader.vertexShader;
  const fs = shader.fragmentShader;

  const material = new ShaderMaterial({
    uniforms: u,
    vertexShader: vs,
    fragmentShader: fs,
  });
  overrideShaderMaterialForMRT(material, "vNormal");

  material.uniforms["uBaseColor"].value = color;

  material.uniforms["uDirLightPos"].value = lightPosition;
  material.uniforms["uDirLightColor"].value = lightColor;

  material.uniforms["uAmbientLightColor"].value = ambientLightColor;

  return material;
}
