import { PointMesh as NavaraPointMesh, BillboardMesh as NavaraBillboardMesh } from "@navara/engine";
import { encodePosition } from "@navara/engine-api";
import instancedSpriteVertexShader from "@shaders/glsl/instancedSprite.vert.glsl";
import instancedSpriteFragmentShader from "@shaders/glsl/instancedSprite.frag.glsl";
import type { BufferLoader } from "../event";
import type { ViewContext } from "../core";
import { InstancedBufferAttribute, InstancedBufferGeometry, Mesh, ShaderMaterial, BufferAttribute, Vector3, DataArrayTexture, UnsignedByteType, RGBAFormat, LinearFilter } from "three";
import { TEXTURE_LOADER } from "../event/loaders";
import invariant from "tiny-invariant";

// TODOs:
// - handle RTE - done
// - handle depth offset - done
// - reenable depth test ... - done
// - make sure texture array and layer attribute are only created for billboard case - done
// - handle style evalutator stuff - see notion page
// - handle layer material, user data, color, height, ... 
// - handle batch ids and picking (if it was working before)...
// - make sure to cover all what was the old point/billboard mesh doing
// - handle choosing between using new sprite mesh or old point mesh based on conditions
// - handle selective layer stuff
// - optimize shader if needed
// - cleanup code
// - test performance and correctness

export type InstancedSpriteOptions = {
    renderOrder?: number;
    viewContext: ViewContext;
    layerId: string;
};

type PositionsInfo = {
    position: Float32Array<ArrayBufferLike> | { high: Float32Array<ArrayBufferLike>, low: Float32Array<ArrayBufferLike> };
    positionSize: number;
    nPositions: number
    RTE: boolean;
};

export class InstancedSpriteMesh extends Mesh {
    constructor(
        options: InstancedSpriteOptions,
    ) {
        super();
    }

    async _init(m: NavaraPointMesh | NavaraBillboardMesh, buf: BufferLoader) {
        const positionsInfo = this.extractPositions(m, buf);
        if (positionsInfo === null) {
            console.warn("No position data found for InstancedSpriteMesh");
            return;
        }

        // Create Geometry
        const instancedGeometry = this._initGeometry(positionsInfo, m);

        // Create Material
        const material = await this._initMaterial(positionsInfo, m);

        // Final Mesh
        this.geometry = instancedGeometry;
        this.material = material;
        this.frustumCulled = false; // Disable since bounding box doesn't account for instance positions
    }

    private _initGeometry(positionsInfo: PositionsInfo, m: NavaraPointMesh | NavaraBillboardMesh) {
        const vertices = new Float32Array([
            -0.5, -0.5, 0.0, // v0
            0.5, -0.5, 0.0,  // v1
            0.5, 0.5, 0.0,   // v2
            -0.5, -0.5, 0.0,  // v3
            0.5, 0.5, 0.0,   // v4
            -0.5, 0.5, 0.0,  // v5
        ]);

        const uvs = new Float32Array([
            0.0, 0.0, // v0
            1.0, 0.0, // v1
            1.0, 1.0, // v2
            0.0, 0.0, // v3
            1.0, 1.0, // v4
            0.0, 1.0, // v5
        ]);

        const instanceCount = positionsInfo.nPositions;

        // Create the Instanced Mesh
        // We use InstancedBufferGeometry to inject our custom attributes
        const instancedGeometry = new InstancedBufferGeometry();
        instancedGeometry.setAttribute('position', new BufferAttribute(vertices, 3));
        instancedGeometry.setAttribute('uv', new BufferAttribute(uvs, 2));
        instancedGeometry.instanceCount = instanceCount;

        // Add Custom Attributes
        const scaleBuffer = new Float32Array(instanceCount);
        let layerBuffer = undefined;

        for (let i = 0; i < instanceCount; i++) {
            // TODO: get scale from user data
            scaleBuffer[i] = 10000.0;
        }

        if (m instanceof NavaraBillboardMesh) {
            layerBuffer = new Float32Array(instanceCount);
            // For billboards, we set layer based on some logic, here we just set to 0
            for (let i = 0; i < instanceCount; i++) {
                layerBuffer[i] = 0; // All use layer 0 for now
            }
            instancedGeometry.setAttribute('instanceLayer', new InstancedBufferAttribute(layerBuffer, 1));
        }

        if (positionsInfo.RTE) {
            const pos = positionsInfo.position as { high: Float32Array<ArrayBufferLike>, low: Float32Array<ArrayBufferLike> };
            instancedGeometry.setAttribute('instancePositionLOW', new InstancedBufferAttribute(pos.low, positionsInfo.positionSize));
            instancedGeometry.setAttribute('instancePositionHIGH', new InstancedBufferAttribute(pos.high, positionsInfo.positionSize));
        } else {
            const pos = positionsInfo.position as Float32Array<ArrayBufferLike>;
            instancedGeometry.setAttribute('instancePosition', new InstancedBufferAttribute(pos, positionsInfo.positionSize));
        }
        instancedGeometry.setAttribute('instanceScale', new InstancedBufferAttribute(scaleBuffer, 1));

        return instancedGeometry;
    }

    private async _initMaterial(positionsInfo: PositionsInfo, m: NavaraPointMesh | NavaraBillboardMesh) {
        const rtcCenter = new Vector3(m.transform.tx, m.transform.ty, m.transform.tz);
        const material: ShaderMaterial = new ShaderMaterial({
            uniforms: {
                uRTCCenter: { value: rtcCenter },
                uEyeRTELow: { value: new Vector3(0, 0, 0) },
                uEyeRTEHigh: { value: new Vector3(0, 0, 0) },
                uOffsetDepth: { value: m.material.offsetDepth ?? true },
                uColor: { value: new Vector3(1.0, 0.0, 0.0) }, // Placeholder color
            },
            vertexShader: instancedSpriteVertexShader,
            fragmentShader: instancedSpriteFragmentShader,
            transparent: true,
        });

        if (positionsInfo.RTE) {
            material.defines.USE_RTE = 1;
            material.onBeforeRender = (_renderer, _scene, camera, _geometry, _mat, _group) => {
                const encodedCamPos = encodePosition(camera.position.x, camera.position.y, camera.position.z);
                material.uniforms.uEyeRTELow.value = new Vector3(encodedCamPos.low.x, encodedCamPos.low.y, encodedCamPos.low.z);
                material.uniforms.uEyeRTEHigh.value = new Vector3(encodedCamPos.high.x, encodedCamPos.high.y, encodedCamPos.high.z);
            }
        }

        if (m instanceof NavaraBillboardMesh) {
            material.defines.BILLBOARD = 1;
            const textureURL = m.material.url;
            const billboardTexture = textureURL ? await TEXTURE_LOADER.loadAsync(textureURL) : undefined;
            if (billboardTexture) {
                const textureArray = new DataArrayTexture(billboardTexture.source.data, billboardTexture.width, billboardTexture.height, 1);
                textureArray.flipY = true;
                textureArray.format = RGBAFormat;
                textureArray.type = UnsignedByteType;
                textureArray.generateMipmaps = true;
                textureArray.needsUpdate = true;
                textureArray.minFilter = LinearFilter
                textureArray.magFilter = LinearFilter

                material.uniforms.uTexture = { value: textureArray };

                billboardTexture.dispose(); // Dispose the original texture as we now have a texture array
                console.log("InstancedSpriteMesh: Loaded billboard texture and created texture array");
            }
        }

        return material;
    }

    private extractPositions(m: NavaraPointMesh | NavaraBillboardMesh, buf: BufferLoader): PositionsInfo | null {
        const g = m.geometry;
        const positionData = g.position;
        const position = positionData
            ? buf.removeF32(positionData.data)
            : undefined;

        if (position && positionData) {
            const positionSize = positionData.size;
            const nPositions = position.length / positionSize;

            return { position, positionSize, nPositions, RTE: false };
        }

        const positionHighData = g.position_3d_high;
        const positionLowData = g.position_3d_low;
        const positionHigh = positionHighData
            ? buf.removeF32(positionHighData.data)
            : undefined;
        const positionLow = positionLowData
            ? buf.removeF32(positionLowData.data)
            : undefined;

        if (positionHigh && positionLow && positionHighData && positionLowData) {
            const positionLowSize = positionLowData.size;
            const positionHighSize = positionHighData.size;
            invariant(positionLowSize === positionHighSize, "Position high and low size mismatch");

            const nPositions = positionHigh.length / positionHighSize;

            return { position: { high: positionHigh, low: positionLow }, positionSize: positionHighSize, nPositions, RTE: true };
        }

        return null;
    }

    _update(active: boolean) {
        if (this.material as ShaderMaterial) {
            const mat = this.material as ShaderMaterial;
            mat.needsUpdate = true;
        }
    }
}
