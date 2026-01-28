import { PointMesh as NavaraPointMesh } from "@navara/engine";
import { degreeToRadian, geodeticToVector3 } from "@navara/three_api";
import type { BufferLoader } from "../event";
import type { ViewContext } from "../core";
import { BufferGeometry, DoubleSide, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, ShaderMaterial, BufferAttribute, Material } from "three";


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
        m: NavaraPointMesh,
        buf: BufferLoader,
        // options: InstancedSpriteOptions,
    ) {
        super();
        const positionsInfo = this.extractPositions(m, buf);
        if (!positionsInfo.position) {
            console.warn("No position data found for InstancedSpriteMesh");
            return;
        }
        this.init(positionsInfo);
    }

    private init(positionsInfo: { position: Float32Array; positionSize: number; nPositions: number }) {
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

        // Create the Custom Material
        const material: ShaderMaterial = new ShaderMaterial({
            uniforms: {
                // uTexture: { value: textureArray },
                // uTime: { value: 0 }
            },
            vertexShader: `                
                attribute vec3 instancePosition; 
                attribute float instanceScale;
                // attribute float instanceLayer; // Which texture layer to use
                
                varying vec2 vUv;
                // varying float vLayer;

                void main() {
                vUv = uv;
                // vLayer = instanceLayer;

                // --- Billboarding Logic ---
                
                // 1. Get the center of the instance in View Space
                vec4 mvPosition = viewMatrix * vec4(instancePosition, 1.0);
                
                // 2. Add the vertex offset (scaling included)
                // This makes it always face the camera
                mvPosition.xyz += position * instanceScale;

                // 3. Project to screen
                gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                // precision highp sampler2DArray; // Important for WebGL 2

                #ifndef USE_SHADOWMAP_DEPTH
                  layout(location = 1) out vec4 outputBuffer1;
                #endif

                // uniform sampler2DArray uTexture;

                varying vec2 vUv;
                // varying float vLayer;

                // Pack normal to vec2 for MRT
                vec2 packNormalToVec2(vec3 normal) {
                  return normal.xy * 0.5 + 0.5;
                }

                void main() {
                // Calculate screen-space normal for MRT compatibility
                vec3 fdx = dFdx(gl_FragCoord.xyz);
                vec3 fdy = dFdy(gl_FragCoord.xyz);
                vec3 normal = normalize(cross(fdx, fdy));
                if (normal.z < 0.0) normal = -normal;

                // Sample the specific layer from the Texture Array
                // vec4 color = texture(uTexture, vec3(vUv, vLayer));
                vec4 color = vec4(1.0, 0.0, 0.0, 1.0); // Placeholder color

                // if (color.a < 0.1) discard; // Alpha test
                gl_FragColor = color;

                #ifndef USE_SHADOWMAP_DEPTH
                  outputBuffer1 = vec4(packNormalToVec2(normal), 0.0, 0.0);
                #endif
                }
            `,
            side: DoubleSide,
            // transparent: true
        });

        // disable depth test for now
        // TODO: consider depth test with offset
        material.depthTest = false;

        // Create the Instanced Mesh
        // We use InstancedBufferGeometry to inject our custom attributes
        const instancedGeometry = new InstancedBufferGeometry();
        instancedGeometry.setAttribute('position', new BufferAttribute(vertices, 3));
        instancedGeometry.setAttribute('uv', new BufferAttribute(uvs, 2));
        instancedGeometry.instanceCount = instanceCount;

        // Add Custom Attributes
        const scaleBuffer = new Float32Array(instanceCount);
        // const layerBuffer = new Float32Array(instanceCount);

        for (let i = 0; i < instanceCount; i++) {
            scaleBuffer[i] = 100000.0;
            // layerBuffer[i] = Math.floor(Math.random() * depth); // Random sprite
        }

        instancedGeometry.setAttribute('instancePosition', new InstancedBufferAttribute(positionsInfo.position, positionsInfo.positionSize));
        instancedGeometry.setAttribute('instanceScale', new InstancedBufferAttribute(scaleBuffer, 1));
        // instancedGeometry.setAttribute('instanceLayer', new InstancedBufferAttribute(layerBuffer, 1));

        // Final Mesh
        this.geometry = instancedGeometry;
        this.material = material;
        this.visible = true;
        this.frustumCulled = false; // Disable since bounding box doesn't account for instance positions
        console.log("InstancedSpriteMesh created with", instanceCount, "instances");
    }

    private extractPositions(m: NavaraPointMesh, buf: BufferLoader) {
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
            console.log("InstancedSpriteMesh material updated");
        }
    }
}
