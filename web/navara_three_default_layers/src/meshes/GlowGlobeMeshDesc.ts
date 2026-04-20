import type ThreeView from "@navara/three";
import {
  Color,
  MeshDesc,
  type MeshConfig,
  type ViewContext,
  type MeshUpdate,
  getWGS84SemiMajorAxis,
  getWGS84Flattening,
} from "@navara/three";
import GlowGlobeFS from "@shaders/glsl/glowGlobe.frag.glsl";
import GlowGlobeVS from "@shaders/glsl/glowGlobe.vert.glsl";
import { BackSide, Mesh, ShaderMaterial, SphereGeometry, Vector4 } from "three";

type Description = {
  /**
   * Configuration for the glow globe mesh descriptor.
   *
   * Implements a Fresnel-based glow effect that creates a halo
   * around a spherical body. The glow intensity varies based on the viewing angle,
   * with maximum intensity at the center and minimum at the edges.
   */
  glowGlobe?: {
    /**
     * The scale factor for the glow globe radius relative to the WGS84 semi-major axis.
     *
     * This value is multiplied by the WGS84 semi-major axis (Earth's equatorial radius)
     * to determine the final glow globe radius. Values greater than 1.0 create a glow
     * globe larger than Earth, which is necessary for the atmospheric effect to be visible
     * around the surface. The globe also respects Earth's flattening factor to maintain
     * an oblate spheroid shape matching the planet.
     *
     * @default 1.2 (120% of Earth's equatorial radius: ~7,653,764 meters)
     * @example 1.1 - Glow globe 10% larger than Earth (typical atmospheric effect)
     * @example 1.05 - Subtle glow close to the surface
     * @example 1.2 - Extended atmospheric glow
     */
    radiusScale?: number;

    /**
     * The coefficient controlling the glow threshold in the Fresnel calculation.
     *
     * This value is subtracted from the facing ratio (dot product of surface normal
     * and view direction) to control where the glow begins. Higher values create
     * a more pronounced glow that extends further toward the edges of the globe.
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
     * the center toward the edges of the globe.
     *
     * Formula: `intensity = pow(max(coefficient - facing_ratio, 0.0), exponent)`
     *
     * @default 5.0
     * @range Typically 1.0 to 10.0, though higher values are valid
     */
    exponent?: number;

    /**
     * The color of the glow effect as a hexadecimal value or NavaraColor instance.
     *
     * Accepts standard hex color formats (e.g., 0x8cf3ff for light cyan) or
     * a NavaraColor instance. The RGB components determine the hue of the glow,
     * which is then modulated by the calculated Fresnel intensity and the opacity value.
     *
     * @default 0x8cf3ff - Light cyan
     * @example 0xff0000 - Red glow
     * @example 0x00ff00 - Green glow
     * @example 0x0080ff - Blue glow
     * @example new Color().setHex(0xff0000) - Red glow using Color instance
     */
    glowColor?: Color;

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

export const DEFAULT_GLOW_GLOBE_OPTIONS: Required<
  NonNullable<Description["glowGlobe"]>
> = {
  radiusScale: 1.2,
  coefficient: 0.5,
  exponent: 5.0,
  glowColor: new Color().setHex(0x8cf3ff),
  opacity: 0.5,
};

export type GlowGlobeMeshConfig = MeshConfig & Description;

export type GlowGlobeMeshUpdate = MeshUpdate & Description;

export class GlowGlobeMeshDesc extends MeshDesc<
  GlowGlobeMeshConfig,
  GlowGlobeMeshUpdate,
  Mesh<SphereGeometry, ShaderMaterial>
> {
  private config: GlowGlobeMeshConfig;
  constructor(view: ThreeView, ctx: ViewContext, config: GlowGlobeMeshConfig) {
    super(view, ctx, config);
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

    this.ctx.applyShadowMaterial(material);
    return new Mesh(geometry, material);
  }

  onUpdateConfig(updates: GlowGlobeMeshUpdate): void {
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

      this.emit("needsUpdate");
    }

    super.onUpdateConfig(updates);
  }

  protected disposeMesh(): void {
    if (this._instance) {
      this.ctx.removeShadowMaterial(this._instance.material);
      this._instance.geometry.dispose();
      this._instance.material.dispose();

      this._instance = undefined;
    }
  }
}
