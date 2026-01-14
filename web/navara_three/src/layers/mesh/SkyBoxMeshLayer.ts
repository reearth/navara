import SkyBoxFS from "@shaders/glsl/skyBox.frag.glsl";
import SkyBoxVS from "@shaders/glsl/skyBox.vert.glsl";
import { BufferGeometry, BufferAttribute, Mesh, ShaderMaterial } from "three";

import {
    MeshLayerDeclaration,
    type MeshLayerConfig,
    type ViewContext,
} from "../../core";
import type { MeshLayerUpdate } from "../../core/MeshLayerDeclaration";

type LayerDescription = {
    skyBox?: {
        // No parameters for now
    };
};

export type SkyBoxMeshLayerConfig = MeshLayerConfig & LayerDescription;

export type SkyBoxMeshLayerUpdate = MeshLayerUpdate & LayerDescription;

export class SkyBoxMeshLayer extends MeshLayerDeclaration<
    SkyBoxMeshLayerConfig,
    SkyBoxMeshLayerUpdate,
    Mesh<BufferGeometry, ShaderMaterial>
> {
    private config: SkyBoxMeshLayerConfig;
    constructor(view: ViewContext, config: SkyBoxMeshLayerConfig) {
        super(view, config);
        this.config = config;
    }

    createMesh() {
        // const cfg = { ...DEFAULT_GLOW_GLOBE_OPTIONS, ...this.config.skyBox };

        // Create geometry from parameters
        const geometry = new BufferGeometry();

        // vector positions for a plane in clip space
        // TODO: use indexed geometry
        const vertices = new Float32Array([
            -1.0, -1.0, 0.99, // v0
             1.0, -1.0, 0.99, // v1
            -1.0,  1.0, 0.99, // v2

             1.0, -1.0, 0.99, // v3
             1.0,  1.0, 0.99, // v4
            -1.0,  1.0, 0.99, // v5
        ]);

        // itemSize = 3 because there are 3 values (components) per vertex
        geometry.setAttribute('position', new BufferAttribute(vertices, 3));

        // Create material from properties
        const material = new ShaderMaterial();
        material.vertexShader = SkyBoxVS;
        material.fragmentShader = SkyBoxFS;

        material.uniforms = {
            // exponent: { value: cfg.exponent },
        };

        this.view.emit("_csmMounted", material);
        return new Mesh(geometry, material);
    }

    onUpdateConfig(updates: SkyBoxMeshLayerUpdate): void {
        if (updates.skyBox && this._instance) {
            const cfg = updates.skyBox;
            const origin = this.config.skyBox;

            // // Update geometry if dimensions changed
            // if (cfg.radiusScale !== undefined) {
            //     this._instance.geometry.dispose();
            //     const new_geometry = new SphereGeometry(
            //         cfg.radiusScale * getWGS84SemiMajorAxis(),
            //         64,
            //         32,
            //         0,
            //         Math.PI * 2,
            //         0,
            //         Math.PI,
            //     );
            //     new_geometry.scale(1, 1, 1 - getWGS84Flattening());
            //     this._instance.geometry = new_geometry;
            // }

            // const material = this._instance.material as ShaderMaterial;
            // if (cfg.coefficient !== undefined) {
            //     material.uniforms["coefficient"].value = cfg.coefficient;
            // }


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
