import { Group, Mesh } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import {
  MeshLayerDeclaration,
  type MeshLayerConfig,
  type MeshLayerUpdate,
  type ViewContext,
} from "../../core";

type LayerDescription = {
  gltfModel?: {
    url: string;
    castShadow?: boolean;
    receiveShadow?: boolean;
  };
};

export type GLTFModelLayerConfig = MeshLayerConfig & LayerDescription;

export type GLTFModelLayerUpdate = MeshLayerUpdate & LayerDescription;

export type GLTFModelLayerEvent = {
  load: () => void;
};

export class GLTFModelLayer extends MeshLayerDeclaration<
  GLTFModelLayerConfig,
  GLTFModelLayerUpdate,
  Group,
  GLTFModelLayerEvent
> {
  private config: GLTFModelLayerConfig;
  private loader: GLTFLoader;

  constructor(view: ViewContext, config: GLTFModelLayerConfig) {
    super(view, config);
    this.config = config;
    this.loader = new GLTFLoader();
  }

  createMesh(): Group {
    const modelConfig = this.config.gltfModel;

    // Create a placeholder group that will be populated async
    const group = new Group();

    if (modelConfig?.url) {
      this.loadModel(modelConfig.url, group);
    }

    return group;
  }

  private async loadModel(url: string, targetGroup: Group): Promise<void> {
    try {
      const gltf = await this.loader.loadAsync(url);

      // Clear any existing children
      while (targetGroup.children.length > 0) {
        targetGroup.remove(targetGroup.children[0]);
      }

      // Add the loaded model
      targetGroup.add(gltf.scene);

      this.setupModel(targetGroup);
      this.emit("_needsUpdate");
      this.emit("load");
    } catch (error) {
      console.error("Failed to load GLTF model:", error);
    }
  }

  private setupModel(model: Group): void {
    const modelConfig = this.config.gltfModel;

    if (!modelConfig) return;

    // Setup shadows
    model.traverse((child) => {
      if (child instanceof Mesh) {
        if (modelConfig.castShadow) child.castShadow = true;
        if (modelConfig.receiveShadow) child.receiveShadow = true;

        // Setup CSM for materials if shadows are enabled
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => {
            this.view.emit("_csmMounted", mat);
          });
        } else {
          this.view.emit("_csmMounted", child.material);
        }
      }
    });
  }

  onUpdateConfig(updates: GLTFModelLayerUpdate): void {
    if (updates.gltfModel && this._instance) {
      const modelConfig = updates.gltfModel;

      // Update shadows
      if (
        modelConfig.castShadow !== undefined ||
        modelConfig.receiveShadow !== undefined
      ) {
        this._instance.traverse((child) => {
          if (child instanceof Mesh) {
            if (modelConfig.castShadow !== undefined)
              child.castShadow = modelConfig.castShadow;
            if (modelConfig.receiveShadow !== undefined)
              child.receiveShadow = modelConfig.receiveShadow;
          }
        });
      }

      // If URL changes, reload the model
      if (modelConfig.url && modelConfig.url !== this.config.gltfModel?.url) {
        this.loadModel(modelConfig.url, this._instance);
        if (this.config.gltfModel) {
          this.config.gltfModel.url = modelConfig.url;
        }
      }

      this.emit("_needsUpdate");
    }

    super.onUpdateConfig(updates);
  }

  protected disposeMesh(): void {
    if (this._instance) {
      this._instance.traverse((child) => {
        if (child instanceof Mesh) {
          child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
      this._instance = undefined;
    }
  }
}
