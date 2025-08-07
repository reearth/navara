import ThreeView, {
  JAPAN_GSI_ELEVATION_DECODER,
  overrideShaderMaterialForMRT,
  MeshLayerDeclaration,
  type MeshLayerConfig,
  type ViewContext,
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
  Matrix4,
  Material,
  type ShaderLibShader,
} from "three";
import { ToonShaderHatching, MarchingCubes } from "three-stdlib";

import type { CloudsEffectLayer } from "../../../src/layers/effect";
import { TERRAIN_URLS, TILE_URLS } from "../../helpers/constants";

// Custom MarchingCubesLayer definition
type MarchingCubesLayerDescription = {
  marchingCubes?: {
    resolution?: number;
    material: Material;
    castShadow?: boolean;
    receiveShadow?: boolean;
    enableUvs?: boolean;
    enableColors?: boolean;
    transformMatrix?: Matrix4;
    scale?: number | Vector3;
  };
};

export type MarchingCubesLayerConfig = MeshLayerConfig &
  MarchingCubesLayerDescription;

export type MarchingCubesLayerUpdate = Pick<
  MeshLayerConfig,
  "position" | "visible"
> &
  MarchingCubesLayerDescription;

export class MarchingCubesLayer extends MeshLayerDeclaration<
  MarchingCubesLayerConfig,
  MarchingCubesLayerUpdate,
  MarchingCubes
> {
  private config: MarchingCubesLayerConfig;

  constructor(view: ViewContext, config: MarchingCubesLayerConfig) {
    super(view, config);
    this.config = config;
  }

  createMesh(): MarchingCubes {
    const cfg = this.config.marchingCubes;
    if (!cfg?.material) {
      throw new Error("MarchingCubes requires a material");
    }

    const cubes = new MarchingCubes(
      cfg.resolution ?? 50,
      cfg.material,
      cfg.enableUvs ?? false,
      cfg.enableColors ?? false,
    );

    cubes.castShadow = cfg.castShadow ?? false;
    cubes.receiveShadow = cfg.receiveShadow ?? false;

    if (cfg.transformMatrix) {
      cubes.applyMatrix4(cfg.transformMatrix);
    }

    if (cfg.scale) {
      if (typeof cfg.scale === "number") {
        cubes.scale.setScalar(cfg.scale);
      } else {
        cubes.scale.copy(cfg.scale);
      }
    }

    // Setup shadow if needed
    if (cubes.castShadow || cubes.receiveShadow) {
      this.view.emit("_csmMounted", cfg.material);
    }

    return cubes;
  }

  onUpdateConfig(updates: MarchingCubesLayerUpdate): void {
    if (updates.marchingCubes && this._instance) {
      const cfg = updates.marchingCubes;

      if (cfg.castShadow !== undefined) {
        this._instance.castShadow = cfg.castShadow;
      }

      if (cfg.receiveShadow !== undefined) {
        this._instance.receiveShadow = cfg.receiveShadow;
      }

      if (cfg.scale !== undefined) {
        if (typeof cfg.scale === "number") {
          this._instance.scale.setScalar(cfg.scale);
        } else {
          this._instance.scale.copy(cfg.scale);
        }
      }

      this.emit("_needsUpdate");
    }

    super.onUpdateConfig(updates);
  }

  getMarchingCubes() {
    return this._instance;
  }

  protected disposeMesh(): void {
    if (this._instance) {
      if (this._instance.geometry) {
        this._instance.geometry.dispose();
      }
      this._instance = undefined;
    }
  }
}

export const run = async (view: ThreeView<MarchingCubesLayerConfig>) => {
  // Register custom MarchingCubesLayer
  view.registerMesh("marchingCubes", MarchingCubesLayer);

  await view.init();

  const defaultEffects = view.addDefaultEffectLayers();
  const defaultLayers = view.addDefaultAtmosphereLayers();

  defaultLayers.sun.update({
    sun: {
      castShadow: true,
    },
  });

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
      receive_shadow: true,
    },
  });

  const hatchingMaterial = createShaderMaterial(
    ToonShaderHatching,
    new Color("#ffffff"),
    new Vector3(0.5, 0.5, 1),
    new Color("#ffffff"),
    new Color("#000"),
  );

  const position = geodeticToVector3(
    new LLE(
      degreeToRadian(35.67564356091717),
      degreeToRadian(139.75711454748298),
      1000,
    ),
  );

  const matrix = eastNorthUpToFixedFrame(position);

  // Use the custom MarchingCubesLayer
  const marchingCubesLayer = view.addLayer<MarchingCubesLayer>({
    type: "mesh",
    marchingCubes: {
      resolution: 50,
      material: hatchingMaterial,
      castShadow: true,
      transformMatrix: matrix,
      scale: new Vector3(1500, 1500, 1500),
    },
    position: { x: position.x, y: position.y, z: position.z },
  });

  // Get the MarchingCubes instance for animation
  const cubes = marchingCubesLayer.ref.getMarchingCubes();

  if (cubes) {
    view.on("preUpdate", (t) => {
      updateCubes(cubes, t * 0.001, 10);
    });
  }
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
