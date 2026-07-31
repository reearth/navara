import ThreeView, {
  Color,
  MeshDesc,
  degreeToRadian,
  eastNorthUpToFixedFrame,
  geodeticToVector3,
  setupMaterialForMRT,
  type MeshConfig,
  type ViewContext,
} from "@navaramap/three";
import {
  DefaultPlugin,
  type DefaultDescriptions,
} from "@navaramap/three-default-plugin";
import { TileJsonPlugin } from "@navaramap/three-plugins";
import {
  Color as ThreeColor,
  ShaderLib,
  ShaderMaterial,
  UniformsUtils,
  Vector3,
  type Material,
} from "three";
import { MarchingCubes, ToonShaderHatching } from "three-stdlib";

import { initializeExample } from "../../../../helpers/initialize";

// Custom mesh

type MarchingCubesConfig = MeshConfig & {
  marchingCubes?: {
    resolution: number;
    material: Material;
    castShadow?: boolean;
  };
};

class MarchingCubesMesh extends MeshDesc<
  MarchingCubesConfig,
  MeshConfig,
  MarchingCubes
> {
  private config: MarchingCubesConfig;

  constructor(view: ThreeView, ctx: ViewContext, config: MarchingCubesConfig) {
    super(view, ctx, config);
    this.config = config;
  }

  createMesh(): MarchingCubes {
    const cfg = this.config.marchingCubes;
    if (!cfg) throw new Error("marchingCubes config is required");
    const cubes = new MarchingCubes(cfg.resolution, cfg.material, false, false);
    cubes.castShadow = cfg.castShadow ?? false;
    // A custom material must opt into the shadow pass to be cast into the CSM.
    if (cubes.castShadow) this.ctx.applyShadowMaterial(cfg.material);
    return cubes;
  }

  protected disposeMesh(): void {
    this._instance?.geometry.dispose();
    this._instance = undefined;
  }
}

// A Three.js hatching toon material wired for Navara's MRT pipeline, so this
// custom mesh writes view-space normals like any built-in material.
const createHatchingMaterial = (): ShaderMaterial => {
  const uniforms = UniformsUtils.merge([
    UniformsUtils.clone(ToonShaderHatching.uniforms),
    ShaderLib.depth.uniforms,
  ]);
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: ToonShaderHatching.vertexShader,
    fragmentShader: ToonShaderHatching.fragmentShader,
  });
  setupMaterialForMRT(material, { normal: "vNormal" });
  material.uniforms["uBaseColor"].value = new ThreeColor("#ffffff");
  material.uniforms["uDirLightPos"].value = new Vector3(0.5, 0.5, 1);
  material.uniforms["uDirLightColor"].value = new ThreeColor("#ffffff");
  material.uniforms["uAmbientLightColor"].value = new ThreeColor("#000000");
  return material;
};

// Rebuild the marching-cubes field from a set of moving metaballs at `time`
// (seconds). Ref: https://github.com/mrdoob/three.js/blob/master/examples/webgl_marchingcubes.html
const animateMetaballs = (surface: MarchingCubes, time: number): void => {
  surface.reset();

  const blobCount = 10;
  const subtract = 12;
  const strength = 1.2 / ((Math.sqrt(blobCount) - 1) / 4 + 1);

  for (let i = 0; i < blobCount; i++) {
    const x =
      Math.sin(i + 1.26 * time * (1.03 + 0.5 * Math.cos(0.21 * i))) * 0.2 + 0.5;
    const y =
      Math.abs(Math.cos(i + 1.12 * time * Math.cos(1.22 + 0.1424 * i))) * 0.3 +
      0.5;
    const z =
      Math.cos(i + 1.32 * time * 0.1 * Math.sin(0.92 + 0.53 * i)) * 0.2 + 0.5;
    surface.addBall(x, y, z, strength, subtract);
  }

  surface.update();
};

// Scene

type CustomDescriptions = DefaultDescriptions & { mesh: MarchingCubesConfig };

const view = new ThreeView<CustomDescriptions>({
  shadow: true,
  useNormal: true,
  backgroundColor: new Color().setHex(0xcccccc),
});

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);
const tilejson = new TileJsonPlugin();
view.addPlugin(tilejson);

await view.init();

// Render continuously so the metaball surface can morph each frame.
view.animation = true;

view.registerMesh("marchingCubes", MarchingCubesMesh);

view.addLight({ ambient: { intensity: 0.5 } });
view.addLight({
  sun: {
    intensity: 2,
    castShadow: true,
    applyColor: true,
    color: new Color().setHex(0xffffff),
  },
});
view.atmosphere.date = new Date("2025-06-21T22:00:00Z");

view.setCamera({
  lng: -86.25,
  lat: 39.15,
  height: 800,
  distance: 4300,
  heading: 168,
  pitch: -22,
  roll: 0,
});

view.addLayer({ type: "terrain", ellipsoid: { receiveShadow: true } });

const basemap = await tilejson.addSource({
  type: "raster-tile",
  url: "https://papers.reearth.land/styles/papers-light/tilejson.json",
});
view.addLayer({ type: "raster", source: basemap });

const anchor = geodeticToVector3({
  lng: degreeToRadian(-86.25),
  lat: degreeToRadian(39.15),
  height: 1200,
});
const blob = view.addMesh<MarchingCubesMesh>({
  marchingCubes: {
    resolution: 48,
    material: createHatchingMaterial(),
    castShadow: true,
  },
  matrixWorld: eastNorthUpToFixedFrame(anchor),
  scale: new Vector3().setScalar(1500),
});

view.on("preUpdate", (time) => {
  const surface = blob.ref.raw;
  if (surface) animateMetaballs(surface, time * 0.001);
});

initializeExample(view);
