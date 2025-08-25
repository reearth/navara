import {
  MeshLayerDeclaration,
  type MeshLayerConfig,
  type MeshLayerUpdate,
  type ViewContext,
} from "@navara/three";
import {
  BoxGeometry,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  type Material,
} from "three";

// Water Plane Layer
type WaterPlaneLayerDescription = {
  waterPlane?: {
    width?: number;
    height?: number;
    material?: Material;
    transformMatrix?: Matrix4;
  };
};

export type WaterPlaneLayerConfig = MeshLayerConfig &
  WaterPlaneLayerDescription;
export type WaterPlaneLayerUpdate = MeshLayerUpdate &
  WaterPlaneLayerDescription;

export class WaterPlaneLayer extends MeshLayerDeclaration<
  WaterPlaneLayerConfig,
  WaterPlaneLayerUpdate,
  Mesh
> {
  private config: WaterPlaneLayerConfig;

  constructor(view: ViewContext, config: WaterPlaneLayerConfig) {
    super(view, config);
    this.config = config;
  }

  protected getPassKey() {
    return "mrt" as const;
  }

  createMesh(): Mesh {
    const cfg = this.config.waterPlane || {};

    const geometry = new PlaneGeometry(cfg.width ?? 10000, cfg.height ?? 10000);
    geometry.computeVertexNormals();

    const material =
      cfg.material ||
      new MeshStandardMaterial({
        color: 0x006994,
        metalness: 0.9,
        roughness: 0.1,
        transparent: true,
        opacity: 0.8,
      });

    const mesh = new Mesh(geometry, material);

    if (cfg.transformMatrix) {
      mesh.applyMatrix4(cfg.transformMatrix);
    }

    return mesh;
  }

  onUpdateConfig(updates: WaterPlaneLayerUpdate): void {
    super.onUpdateConfig(updates);

    if (updates.waterPlane && this._instance) {
      const cfg = updates.waterPlane;

      if (cfg.material) {
        this._instance.material = cfg.material;
      }

      if (cfg.width !== undefined || cfg.height !== undefined) {
        const newGeometry = new PlaneGeometry(
          cfg.width ?? 10000,
          cfg.height ?? 10000,
        );
        this._instance.geometry.dispose();
        this._instance.geometry = newGeometry;
      }
    }
  }
}

// Reflective Box Layer
type ReflectiveBoxLayerDescription = {
  reflectiveBox?: {
    width?: number;
    height?: number;
    depth?: number;
    material?: Material;
    transformMatrix?: Matrix4;
  };
};

export type ReflectiveBoxLayerConfig = MeshLayerConfig &
  ReflectiveBoxLayerDescription;
export type ReflectiveBoxLayerUpdate = MeshLayerUpdate &
  ReflectiveBoxLayerDescription;

export class ReflectiveBoxLayer extends MeshLayerDeclaration<
  ReflectiveBoxLayerConfig,
  ReflectiveBoxLayerUpdate,
  Mesh
> {
  private config: ReflectiveBoxLayerConfig;

  constructor(view: ViewContext, config: ReflectiveBoxLayerConfig) {
    super(view, config);
    this.config = config;
  }

  protected getPassKey() {
    return "mrt" as const;
  }

  createMesh(): Mesh {
    const cfg = this.config.reflectiveBox || {};

    const geometry = new BoxGeometry(
      cfg.width ?? 100,
      cfg.height ?? 100,
      cfg.depth ?? 100,
    );

    const material =
      cfg.material ||
      new MeshStandardMaterial({
        color: 0xff0000,
        metalness: 0.8,
        roughness: 0.2,
      });

    const mesh = new Mesh(geometry, material);

    if (cfg.transformMatrix) {
      mesh.applyMatrix4(cfg.transformMatrix);
    }

    return mesh;
  }

  onUpdateConfig(updates: ReflectiveBoxLayerUpdate): void {
    super.onUpdateConfig(updates);

    if (updates.reflectiveBox && this._instance) {
      const cfg = updates.reflectiveBox;

      if (cfg.material) {
        this._instance.material = cfg.material;
      }

      if (
        cfg.width !== undefined ||
        cfg.height !== undefined ||
        cfg.depth !== undefined
      ) {
        const newGeometry = new BoxGeometry(
          cfg.width ?? 100,
          cfg.height ?? 100,
          cfg.depth ?? 100,
        );
        this._instance.geometry.dispose();
        this._instance.geometry = newGeometry;
      }
    }
  }
}
