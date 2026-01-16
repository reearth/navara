import SkyBoxFS from "@shaders/glsl/skyBox.frag.glsl";
import SkyBoxVS from "@shaders/glsl/skyBox.vert.glsl";
import { BufferGeometry, BufferAttribute, Mesh, ShaderMaterial, Vector3 } from "three";

import { Color } from "../../Color";

import {
    MeshLayerDeclaration,
    type MeshLayerConfig,
    type ViewContext,
} from "../../core";
import type { MeshLayerUpdate } from "../../core/MeshLayerDeclaration";

type LayerDescription = {
    skyBox?: {
        dayColor?: Color;
        nightColor?: Color;
    };
};

export type SkyBoxMeshLayerConfig = MeshLayerConfig & LayerDescription;

export type SkyBoxMeshLayerUpdate = MeshLayerUpdate & LayerDescription;

export const DEFAULT_SKY_BOX_OPTIONS: Required<NonNullable<LayerDescription["skyBox"]>> = {
    // dayColor: new Color().setHex(0x87ceeb), // light blue
    dayColor: new Color().setHex(0x88c7fc), // light blue
    nightColor: new Color().setHex(0x000033), // dark blue
};

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
        const cfg = { ...DEFAULT_SKY_BOX_OPTIONS, ...this.config.skyBox };

        // Create geometry from parameters
        const geometry = new BufferGeometry();

        // vector positions for a plane in clip space
        // TODO: use indexed geometry, or, better yet, a single triangle that covers the screen
        const vertices = new Float32Array([
            -1.0, -1.0, 1.0, // v0
            1.0, -1.0, 1.0, // v1
            -1.0, 1.0, 1.0, // v2

            1.0, -1.0, 1.0, // v3
            1.0, 1.0, 1.0, // v4
            -1.0, 1.0, 1.0, // v5
        ]);

        geometry.setAttribute('position', new BufferAttribute(vertices, 3));

        // Create material from properties
        const material = new ShaderMaterial();
        material.vertexShader = SkyBoxVS;
        material.fragmentShader = SkyBoxFS;
        material.transparent = true;

        const dayColor = cfg.dayColor.toArray();
        const nightColor = cfg.nightColor.toArray();
        const sunDirection = this.view.atmosphere.sunDirection;

        material.uniforms = {
            dayColor: {
                value: new Vector3(dayColor[0], dayColor[1], dayColor[2]),
            },
            nightColor: {
                value: new Vector3(nightColor[0], nightColor[1], nightColor[2]),
            },
            sunDirection: {
                value: sunDirection,
            },
        };

        this.view.emit("_csmMounted", material);
        const mesh = new Mesh(geometry, material);
        mesh.frustumCulled = false;
        // mesh.renderOrder = 0xFFFF; // Render last
        return mesh;
    }

    onUpdateConfig(updates: SkyBoxMeshLayerUpdate): void {
        if (updates.skyBox && this._instance) {
            const cfg = updates.skyBox;
            const origin = this.config.skyBox;

            const material = this._instance.material as ShaderMaterial;
            if (cfg.dayColor !== undefined) {
                const dayColorArray = cfg.dayColor.toArray();
                material.uniforms["dayColor"].value = new Vector3(dayColorArray[0], dayColorArray[1], dayColorArray[2]);
            }

            if (cfg.nightColor !== undefined) {
                const nightColorArray = cfg.nightColor.toArray();
                material.uniforms["nightColor"].value = new Vector3(nightColorArray[0], nightColorArray[1], nightColorArray[2]);
            }

            // Update the stored config with the new values
            if (origin) {
                Object.assign(origin, cfg);
            }

            this.emit("_needsUpdate");
        }

        super.onUpdateConfig(updates);
    }

    update(time: number): void {
        if (!this._instance) return;

        // Update sun direction uniform
        const material = this._instance.material as ShaderMaterial;
        material.uniforms["sunDirection"].value = this.view.atmosphere.sunDirection;

        this.emit("_needsUpdate");
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
