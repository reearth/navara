import { PointMesh as NavaraPointMesh } from "@navara/engine";
import { degreeToRadian, geodeticToVector3 } from "@navara/three_api";
import type { BufferLoader } from "../event";
import type { ViewContext } from "../core";
import { DoubleSide, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, ShaderMaterial } from "three";


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
    // more points
    -0.12775, 51.50735,
    -2.24263, 53.48095,
    -1.54907, 53.80076,
    -1.88229, 53.72655
];

export class InstancedSpriteMesh extends Mesh {
    constructor(
        m: NavaraPointMesh,
        buf: BufferLoader,
        // options: InstancedSpriteOptions,
    ) {
        super();
        this.init();
    }

    private init() {
        // Setup Geometry & Instances
        const geometry = new PlaneGeometry(1, 1);
        const instanceCount = dummyData.length / 2; // TODO: Set actual instance count

        // Create the Custom Material
        const material = new ShaderMaterial({
            uniforms: {
                // uTexture: { value: textureArray },
                // uTime: { value: 0 }
            },
            vertexShader: `                
                // Instance attributes (We will define these next)
                attribute vec3 instancePosition; 
                attribute float instanceScale;
                // attribute float instanceLayer; // Which texture layer to use
                
                // Pass UV and Layer to fragment shader
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

        // Create the Instanced Mesh
        // We use InstancedBufferGeometry to inject our custom attributes
        const instancedGeometry = new InstancedBufferGeometry();
        instancedGeometry.setAttribute('position', geometry.getAttribute('position'));
        instancedGeometry.setAttribute('uv', geometry.getAttribute('uv'));
        instancedGeometry.setIndex(geometry.getIndex());
        instancedGeometry.instanceCount = instanceCount;

        // Add Custom Attributes
        const posBuffer = new Float32Array(instanceCount * 3);
        const scaleBuffer = new Float32Array(instanceCount);
        // const layerBuffer = new Float32Array(instanceCount);

        for (let i = 0; i < instanceCount; i++) {
            const lngDeg = dummyData[i * 2 + 0];
            const latDeg = dummyData[i * 2 + 1];
            const pos = geodeticToVector3({
                lng: degreeToRadian(lngDeg),
                lat: degreeToRadian(latDeg),
                height: 10000,
            });

            posBuffer[i * 3 + 0] = pos.x; // X (ECEF)
            posBuffer[i * 3 + 1] = pos.y; // Y (ECEF)
            posBuffer[i * 3 + 2] = pos.z; // Z (ECEF)

            scaleBuffer[i] = 100.0;
            // layerBuffer[i] = Math.floor(Math.random() * depth); // Random sprite
        }

        instancedGeometry.setAttribute('instancePosition', new InstancedBufferAttribute(posBuffer, 3));
        instancedGeometry.setAttribute('instanceScale', new InstancedBufferAttribute(scaleBuffer, 1));
        // instancedGeometry.setAttribute('instanceLayer', new InstancedBufferAttribute(layerBuffer, 1));

        // Final Mesh
        this.geometry = instancedGeometry;
        this.material = material;
        this.frustumCulled = false; // Disable since bounding box doesn't account for instance positions
    }
}
