import { getWGS84SemiMajorAxis, getWGS84Flattening } from "@navara/engine-api";
import {
  Color,
  MeshLayerDeclaration,
  type MeshLayerConfig,
  type ViewContext,
  type MeshLayerUpdate,
} from "@navara/three";
import GlowGlobeFS from "@shaders/glsl/glowGlobe.frag.glsl";
import GlowGlobeVS from "@shaders/glsl/glowGlobe.vert.glsl";
import { BackSide, Mesh, ShaderMaterial, SphereGeometry, Vector4 } from "three";

type LayerDescription = {
  glowGlobe?: {
    radiusScale?: number;
    coefficient?: number;
    exponent?: number;
    glowColor?: Color;
    opacity?: number;
  };
};

export const DEFAULT_GLOW_GLOBE_OPTIONS: Required<
  NonNullable<LayerDescription["glowGlobe"]>
> = {
  radiusScale: 1.2,
  coefficient: 0.5,
  exponent: 5.0,
  glowColor: new Color().setHex(0x8cf3ff),
  opacity: 0.5,
};

export type GlowGlobeMeshLayerConfig = MeshLayerConfig & LayerDescription;

export type GlowGlobeMeshLayerUpdate = MeshLayerUpdate & LayerDescription;

export class GlowGlobeMeshLayer extends MeshLayerDeclaration<
  GlowGlobeMeshLayerConfig,
  GlowGlobeMeshLayerUpdate,
  Mesh<SphereGeometry, ShaderMaterial>
> {
  private config: GlowGlobeMeshLayerConfig;
  constructor(view: ViewContext, config: GlowGlobeMeshLayerConfig) {
    super(view, config);
    this.config = config;
  }

  createMesh() {
    const cfg = { ...DEFAULT_GLOW_GLOBE_OPTIONS, ...this.config.glowGlobe };

    // Create geometry from parameters
    const geometry = new SphereGeometry(
      cfg.radiusScale * getWGS84SemiMajorAxis(),
      64,
      32,
      0,
      Math.PI * 2,
      0,
      Math.PI,
    );

    // Apply flattening to simulate oblate spheroid shape
    geometry.scale(1, 1, 1 - getWGS84Flattening());

    // Create material from properties
    const material = new ShaderMaterial();
    material.vertexShader = GlowGlobeVS;
    material.fragmentShader = GlowGlobeFS;
    material.transparent = true;
    material.side = BackSide;

    const color = cfg.glowColor.toArray();

    material.uniforms = {
      exponent: { value: cfg.exponent },
      coefficient: { value: cfg.coefficient },
      glowColor: {
        value: new Vector4(color[0], color[1], color[2], cfg.opacity),
      },
    };

    this.view.emit("_csmMounted", material);
    return new Mesh(geometry, material);
  }

  onUpdateConfig(updates: GlowGlobeMeshLayerUpdate): void {
    if (updates.glowGlobe && this._instance) {
      const cfg = updates.glowGlobe;
      const origin = this.config.glowGlobe;

      // Update geometry if dimensions changed
      if (cfg.radiusScale !== undefined) {
        this._instance.geometry.dispose();
        const new_geometry = new SphereGeometry(
          cfg.radiusScale * getWGS84SemiMajorAxis(),
          64,
          32,
          0,
          Math.PI * 2,
          0,
          Math.PI,
        );
        new_geometry.scale(1, 1, 1 - getWGS84Flattening());
        this._instance.geometry = new_geometry;
      }

      const material = this._instance.material as ShaderMaterial;
      if (cfg.coefficient !== undefined) {
        material.uniforms["coefficient"].value = cfg.coefficient;
      }

      if (cfg.exponent !== undefined) {
        material.uniforms["exponent"].value = cfg.exponent;
      }

      if (cfg.glowColor !== undefined || cfg.opacity !== undefined) {
        let color = cfg.glowColor?.toArray();
        if (!color) {
          color =
            origin?.glowColor?.toArray() ||
            DEFAULT_GLOW_GLOBE_OPTIONS.glowColor.toArray();
        }

        material.uniforms["glowColor"].value = new Vector4(
          color[0],
          color[1],
          color[2],
          cfg.opacity ?? origin?.opacity ?? DEFAULT_GLOW_GLOBE_OPTIONS.opacity,
        );
      }

      // Update the stored config with the new values
      if (origin) {
        Object.assign(origin, cfg);
      }

      this.emit("_needsUpdate");
    }

    super.onUpdateConfig(updates);
  }

  protected disposeMesh(): void {
    if (this._instance) {
      this.view.emit("_csmUnmounted", this._instance.material);
      this._instance.geometry.dispose();
      this._instance.material.dispose();

      this._instance = undefined;
    }
  }
}
