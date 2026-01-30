import { PointMesh as NavaraPointMesh, BillboardMesh as NavaraBillboardMesh } from "@navara/engine";
import instancedSpriteVertexShader from "@shaders/glsl/instancedSprite.vert.glsl";
import instancedSpriteFragmentShader from "@shaders/glsl/instancedSprite.frag.glsl";
import type { BufferLoader } from "../event";
import type { ViewContext } from "../core";
import { DoubleSide, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, ShaderMaterial, BufferAttribute, Vector3, DataArrayTexture, UnsignedByteType, RGBAFormat, LinearFilter } from "three";
import { IMAGE_LOADER, TEXTURE_LOADER } from "../event/loaders";


export type InstancedSpriteOptions = {
    renderOrder?: number;
    viewContext: ViewContext;
    layerId: string;
};

// dummy data for now: lat long of some points
// convert these lat long to wgs84 x,y for testing
const dummyData = [
    -3.18827, 55.95325,
    -1.86168, 53.72128,
    -2.09818, 53.71589,
    -2.10975, 53.71997,
    -2.09666, 53.714,
];

export class InstancedSpriteMesh extends Mesh {
    constructor(
        options: InstancedSpriteOptions,
    ) {
        super();
    }

    async _init(m: NavaraPointMesh | NavaraBillboardMesh, buf: BufferLoader) {
        // TODO: also handle RTE
        const positionsInfo = this.extractPositions(m, buf);
        if (!positionsInfo.position) {
            console.warn("No position data found for InstancedSpriteMesh");
            return;
        }

        // Setup Geometry & Instances
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
        const layerBuffer = new Float32Array(instanceCount);

        for (let i = 0; i < instanceCount; i++) {
            // TODO: get scale from user data
            scaleBuffer[i] = 10000.0;
            layerBuffer[i] = 0; // Random sprite
        }

        instancedGeometry.setAttribute('instancePosition', new InstancedBufferAttribute(positionsInfo.position, positionsInfo.positionSize));
        instancedGeometry.setAttribute('instanceScale', new InstancedBufferAttribute(scaleBuffer, 1));
        // instancedGeometry.setAttribute('instanceLayer', new InstancedBufferAttribute(layerBuffer, 1));

        // Create the Custom Material
        const rtcCenter = new Vector3(m.transform.tx, m.transform.ty, m.transform.tz);
        const material: ShaderMaterial = new ShaderMaterial({
            uniforms: {
                // uTexture: { value: textureArray },
                uRTCCenter: { value: rtcCenter }
            },
            vertexShader: instancedSpriteVertexShader,
            fragmentShader: instancedSpriteFragmentShader,
            side: DoubleSide,
        });

        if (m instanceof NavaraBillboardMesh) {
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
                instancedGeometry.setAttribute('instanceLayer', new InstancedBufferAttribute(layerBuffer, 1));

                billboardTexture.dispose(); // Dispose the original texture as we now have a texture array
                console.log("InstancedSpriteMesh: Loaded billboard texture and created texture array");
            }
        }

        // disable depth test for now
        // TODO: consider depth test with offset
        material.depthTest = false;

        // Final Mesh
        this.geometry = instancedGeometry;
        this.material = material;
        this.frustumCulled = false; // Disable since bounding box doesn't account for instance positions
    }

    private extractPositions(m: NavaraPointMesh | NavaraBillboardMesh, buf: BufferLoader) {
        const g = m.geometry;
        const positionData = g.position;
        const position = positionData
            ? buf.removeF32(positionData.data)
            : undefined;

        if (!position || !positionData) return {};

        const positionSize = positionData.size;
        const nPositions = position.length / positionSize;

        return { position, positionSize, nPositions };
    }

    _update(active: boolean) {
        if (this.material as ShaderMaterial) {
            const mat = this.material as ShaderMaterial;
            mat.needsUpdate = true;
        }
    }
}
