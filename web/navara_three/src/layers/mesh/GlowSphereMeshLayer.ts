import GlowSphereFS from "@shaders/glsl/GlowSphere.frag.glsl";
import GlowSphereVS from "@shaders/glsl/GlowSphere.vert.glsl";
import { BackSide, Mesh, ShaderMaterial, SphereGeometry, Vector4 } from "three";

import {
  MeshLayerDeclaration,
  type MeshLayerConfig,
  type ViewContext,
} from "../../core";
import type { MeshLayerUpdate } from "../../core/MeshLayerDeclaration";

type LayerDescription = {
  glowSphere?: {
    radius?: number;
    coefficient?: number;
    exponent?: number;
    glowColor?: { r: number; g: number; b: number; a: number };
  };
};

export type GlowSphereMeshLayerConfig = MeshLayerConfig & LayerDescription;

export type GlowSphereMeshLayerUpdate = MeshLayerUpdate & LayerDescription;

export class GlowSphereMeshLayer extends MeshLayerDeclaration<
  GlowSphereMeshLayerConfig,
  GlowSphereMeshLayerUpdate,
  Mesh<SphereGeometry, ShaderMaterial>
> {
  private config: GlowSphereMeshLayerConfig;

  constructor(view: ViewContext, config: GlowSphereMeshLayerConfig) {
    super(view, config);
    this.config = config;
  }

  createMesh() {
    const cfg = this.config.glowSphere ?? {};

    // Create geometry from parameters
    const geometry = new SphereGeometry(
      cfg.radius ?? 6378137 * 1.1,
      64,
      32,
      0,
      Math.PI * 2,
      0,
      Math.PI,
    );

    // Create material from properties
    const material = new ShaderMaterial();
    material.vertexShader = GlowSphereVS;
    material.fragmentShader = GlowSphereFS;
    material.transparent = true;
    material.side = BackSide;

    material.uniforms = {
      exponent: { value: cfg.exponent ?? 5 },
      coefficient: { value: cfg.coefficient ?? 0.5 },
      glowColor: {
        value: new Vector4(
          cfg.glowColor?.r ?? 0.549,
          cfg.glowColor?.g ?? 0.894,
          cfg.glowColor?.b ?? 1.0,
          cfg.glowColor?.a ?? 0.5,
        ),
      },
    };

    this.view.emit("_csmMounted", material);
    return new Mesh(geometry, material);
  }

  onUpdateConfig(updates: GlowSphereMeshLayerUpdate): void {
    if (updates.glowSphere && this._instance) {
      const cfg = updates.glowSphere;
      const origin = this.config.glowSphere;

      // Update geometry if dimensions changed
      if (cfg.radius !== undefined) {
        this._instance.geometry.dispose();
        this._instance.geometry = new SphereGeometry(
          cfg.radius ?? origin?.radius,
          64,
          32,
          0,
          Math.PI * 2,
          0,
          Math.PI,
        );
      }

      const material = this._instance.material as ShaderMaterial;
      if (cfg.coefficient !== undefined) {
        material.uniforms["coefficient"].value = cfg.coefficient;
      }

      if (cfg.exponent !== undefined) {
        material.uniforms["exponent"].value = cfg.exponent;
      }

      if (cfg.glowColor !== undefined) {
        material.uniforms["glowColor"].value = new Vector4(
          cfg.glowColor?.r ?? 0.549,
          cfg.glowColor?.g ?? 0.894,
          cfg.glowColor?.b ?? 1.0,
          cfg.glowColor?.a ?? 0.5,
        );
      }

      if (cfg.show !== undefined) {
        material.visible = cfg.show;
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
