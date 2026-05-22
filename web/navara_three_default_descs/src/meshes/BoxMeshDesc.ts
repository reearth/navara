import type ThreeView from "@navara/three";
import {
  Color,
  DrapedMesh,
  NewMeshDesc,
  type MeshDescConfig,
  type MeshDescUpdate,
  type ViewContext,
  type CustomObject3DEventMap,
  type PassKey,
} from "@navara/three";
import { BoxGeometry, type Object3DEventMap } from "three";
import {
  MeshBasicNodeMaterial,
  MeshLambertNodeMaterial,
  type NodeMaterial,
} from "three/webgpu";

type BoxMeshEventMap = Object3DEventMap & CustomObject3DEventMap;

type Description = {
  box?: {
    width?: number;
    height?: number;
    depth?: number;
    widthSegments?: number;
    heightSegments?: number;
    depthSegments?: number;
    color?: Color;
    emissiveColor?: Color;
    emissiveIntensity?: number;
    opacity?: number;
    transparent?: boolean;
    castShadow?: boolean;
    receiveShadow?: boolean;
    effectIds?: string[];
    /**
     * To drape the mesh properly on the terrain,
     * the mesh must cover the terrain.
     */
    draped?: boolean;
    // TODO: This is just for debugging. Remove later.
    colorNode?: NodeMaterial["colorNode"];
  };
};

export type BoxMeshConfig = MeshDescConfig & Description;

export type BoxMeshUpdate = MeshDescUpdate & Description;

type BoxMeshMaterial = MeshLambertNodeMaterial | MeshBasicNodeMaterial;

export class BoxMeshDesc extends NewMeshDesc<
  BoxMeshConfig,
  BoxMeshUpdate,
  DrapedMesh<BoxGeometry, BoxMeshMaterial, BoxMeshEventMap>
> {
  private config: BoxMeshConfig;

  constructor(view: ThreeView, ctx: ViewContext, config: BoxMeshConfig) {
    // Propagate initial effectIds to MeshDescBase
    if (config.box?.effectIds) {
      config.effectIds = config.box.effectIds;
    }
    super(view, ctx, config);
    this.config = config;

    // Drive the MRT emissive uniforms from this box's config.
    if (config.box?.emissiveColor !== undefined) {
      this.emissive = config.box.emissiveColor;
    }
    if (config.box?.emissiveIntensity !== undefined) {
      this.emissiveIntensity = config.box.emissiveIntensity;
    }
  }

  createMesh() {
    const cfg = this.config.box;
    if (!cfg) {
      throw new Error("BoxMesh configuration is required");
    }

    const geometry = new BoxGeometry(
      cfg.width ?? 1,
      cfg.height ?? 1,
      cfg.depth ?? 1,
      cfg.widthSegments ?? 1,
      cfg.heightSegments ?? 1,
      cfg.depthSegments ?? 1,
    );

    const material = this.createMaterial(cfg);

    const mesh = new DrapedMesh<BoxGeometry, BoxMeshMaterial, BoxMeshEventMap>(
      geometry,
      material,
      cfg.draped ?? false,
    );

    mesh.castShadow = cfg.castShadow ?? false;
    mesh.receiveShadow = cfg.receiveShadow ?? false;

    return mesh;
  }

  private createMaterial(
    cfg: NonNullable<BoxMeshConfig["box"]>,
  ): BoxMeshMaterial {
    const colorValue = cfg.color ?? new Color().setStyle("#ffffff");
    const baseParams = {
      color: colorValue.raw,
      opacity: cfg.opacity ?? 1,
      transparent: cfg.transparent ?? false,
    };

    if (cfg.draped) {
      const material = new MeshBasicNodeMaterial(baseParams);
      if (cfg.colorNode) material.colorNode = cfg.colorNode;
      return material;
    }

    const material = new MeshLambertNodeMaterial(baseParams);
    material.emissive.set(cfg.emissiveColor?.raw ?? 0x000000);
    material.emissiveIntensity = cfg.emissiveIntensity ?? 0;
    if (cfg.colorNode) material.colorNode = cfg.colorNode;
    return material;
  }

  protected override getPassKey(): PassKey {
    if (this.config.box?.draped) {
      return "draped";
    }
    return super.getPassKey();
  }

  onUpdateConfig(updates: BoxMeshUpdate): void {
    if (updates.box && this._instance) {
      const cfg = updates.box;
      const origin = this.config.box;

      // Handle draped change BEFORE super.onUpdateConfig() so getPassKey() returns correct value
      if (cfg.draped !== undefined && origin) {
        const wasChanged = origin.draped !== cfg.draped;
        origin.draped = cfg.draped;
        this._instance.drapedEnable = cfg.draped;

        if (wasChanged) {
          this._instance.material.dispose();
          const newMaterial = this.createMaterial(origin);
          this._instance.material = newMaterial;
          // Pickable handle is preserved across draped swaps; re-run the
          // NodeMaterial setup against the freshly-created material.
          this.refreshNodeMaterial();
        }
      }

      // Update geometry if dimensions changed
      if (
        cfg.width !== undefined ||
        cfg.height !== undefined ||
        cfg.depth !== undefined ||
        cfg.widthSegments !== undefined ||
        cfg.heightSegments !== undefined ||
        cfg.depthSegments !== undefined
      ) {
        this._instance.geometry.dispose();
        this._instance.geometry = new BoxGeometry(
          cfg.width ?? origin?.width ?? 1,
          cfg.height ?? origin?.height ?? 1,
          cfg.depth ?? origin?.depth ?? 1,
          cfg.widthSegments ?? origin?.widthSegments ?? 1,
          cfg.heightSegments ?? origin?.heightSegments ?? 1,
          cfg.depthSegments ?? origin?.depthSegments ?? 1,
        );

        if (origin) {
          Object.assign(origin, cfg);
        }
      }

      if (
        cfg.color !== undefined ||
        cfg.opacity !== undefined ||
        cfg.transparent !== undefined
      ) {
        const material = this._instance.material;
        if (cfg.color !== undefined) {
          material.color.set(cfg.color.raw);
        }
        if (cfg.opacity !== undefined) material.opacity = cfg.opacity;
        if (cfg.transparent !== undefined)
          material.transparent = cfg.transparent;
        material.needsUpdate = true;
      }

      if (cfg.castShadow !== undefined) {
        this._instance.castShadow = cfg.castShadow;
      }

      if (cfg.receiveShadow !== undefined) {
        this._instance.receiveShadow = cfg.receiveShadow;
      }

      // Propagate effectIds to base MeshDesc
      if (cfg.effectIds !== undefined) {
        updates.effectIds = cfg.effectIds;
      }
      if (cfg.emissiveColor !== undefined) {
        this.emissive = cfg.emissiveColor;
      }
      if (cfg.emissiveIntensity !== undefined) {
        this.emissiveIntensity = cfg.emissiveIntensity;
      }
      this.emit("needsUpdate");
    }

    super.onUpdateConfig(updates);
  }

  protected disposeMesh(): void {
    if (this._instance) {
      this._instance.geometry.dispose();
      this._instance.material.dispose();
      this._instance = undefined;
    }
  }
}
