import { getWGS84SemiMajorAxis, getWGS84Flattening } from "@navara/engine-api";
import GlowSphereFS from "@shaders/glsl/glowSphere.frag.glsl";
import GlowSphereVS from "@shaders/glsl/glowSphere.vert.glsl";
import { BackSide, Mesh, ShaderMaterial, SphereGeometry, Vector4 } from "three";

import { Color } from "../../Color";
import {
  MeshLayerDeclaration,
  type MeshLayerConfig,
  type ViewContext,
} from "../../core";
import type { MeshLayerUpdate } from "../../core/MeshLayerDeclaration";

/**
 * Configuration for the glow sphere mesh layer.
 *
 * Implements a Fresnel-based glow effect that creates an halo
 * around a spherical body. The glow intensity varies based on the viewing angle,
 * with maximum intensity at the center and minimum at the center.
 */
type LayerDescription = {
  glowSphere?: {
    /**
     * The scale factor for the glow sphere radius relative to the WGS84 semi-major axis.
     *
     * This value is multiplied by the WGS84 semi-major axis (Earth's equatorial radius)
     * to determine the final glow sphere radius. Values greater than 1.0 create a glow
     * sphere larger than Earth, which is necessary for the atmospheric effect to be visible
     * around the surface. The sphere also respects Earth's flattening factor to maintain
     * an oblate spheroid shape matching the planet.
     *
     * @default 1.0 (same size as Earth's equatorial radius: ~6,378,137 meters)
     * @example 1.1 - Glow sphere 10% larger than Earth (typical atmospheric effect)
     * @example 1.05 - Subtle glow close to the surface
     * @example 1.2 - Extended atmospheric glow
     */
    radiusScale?: number;

    /**
     * The coefficient controlling the glow threshold in the Fresnel calculation.
     *
     * This value is subtracted from the facing ratio (dot product of surface normal
     * and view direction) to control where the glow begins. Higher values create
     * a more pronounced glow that extends further toward the edges of the sphere.
     *
     * Formula: `intensity = pow(max(coefficient - facing_ratio, 0.0), exponent)`
     *
     * @default 0.5
     * @range Typically 0.0 to 1.0, though values outside this range are valid
     */
    coefficient?: number;

    /**
     * The exponent controlling the glow falloff intensity in the Fresnel calculation.
     *
     * Higher values create a sharper, more concentrated glow at the center.
     * Lower values create a softer, more diffuse glow that extends outward.
     * This parameter controls how quickly the glow intensity decreases from
     * the center toward the edges of the sphere.
     *
     * Formula: `intensity = pow(max(coefficient - facing_ratio, 0.0), exponent)`
     *
     * @default 5.0
     * @range Typically 1.0 to 10.0, though higher values are valid
     */
    exponent?: number;

    /**
     * The color of the glow effect as a hexadecimal value.
     *
     * Accepts standard hex color formats (e.g., 0x8cf3ff for light cyan).
     * The RGB components determine the hue of the glow, which is then
     * modulated by the calculated Fresnel intensity and the opacity value.
     *
     * @default 0x8cf3ff - Light cyan
     * @example 0xff0000 - Red glow
     * @example 0x00ff00 - Green glow
     * @example 0x0080ff - Blue glow
     */
    glowColor?: number;

    /**
     * The opacity/alpha channel of the glow effect.
     *
     * Controls the overall transparency of the glow layer. This value is used
     * as the alpha component in the shader's color uniform. Lower values create
     * a more subtle, transparent glow, while higher values make it more opaque.
     *
     * @default 0.5
     * @range 0.0 (fully transparent) to 1.0 (fully opaque)
     */
    opacity?: number;
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
      (cfg.radiusScale ?? 1) * getWGS84SemiMajorAxis(),
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
    material.vertexShader = GlowSphereVS;
    material.fragmentShader = GlowSphereFS;
    material.transparent = true;
    material.side = BackSide;

    const color = new Color().setHex(cfg.glowColor ?? 0x8cf3ff).toArray();

    material.uniforms = {
      exponent: { value: cfg.exponent ?? 5 },
      coefficient: { value: cfg.coefficient ?? 0.5 },
      glowColor: {
        value: new Vector4(
          color[0] ?? 0.549,
          color[1] ?? 0.894,
          color[2] ?? 1.0,
          cfg.opacity ?? 0.5,
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
      if (cfg.radiusScale !== undefined) {
        this._instance.geometry.dispose();
        this._instance.geometry = new SphereGeometry(
          (cfg.radiusScale ?? origin?.radiusScale ?? 1) *
            getWGS84SemiMajorAxis(),
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

      if (cfg.glowColor !== undefined || cfg.opacity !== undefined) {
        const color = new Color()
          .setHex(cfg.glowColor ?? origin?.glowColor ?? 0x8cf3ff)
          .toArray();

        material.uniforms["glowColor"].value = new Vector4(
          color[0] ?? 0.549,
          color[1] ?? 0.894,
          color[2] ?? 1.0,
          cfg.opacity ?? origin?.opacity ?? 0.5,
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
