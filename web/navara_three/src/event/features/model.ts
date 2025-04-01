import type { ModelMesh, ModelMaterial } from "@navara/engine";
import Pick from "@shaders/glsl/chunks/pick.glsl";
import {
  BufferAttribute,
  Mesh,
  Object3D,
  Group,
  MeshStandardMaterial,
  MeshPhysicalMaterial,
} from "three";

import type { BufferLoader } from "../";
import type { CommonUniforms } from "../../uniforms";
import { initializeGltfLoader } from "../loaders";

export async function renderModel(
  m: ModelMesh,
  buf: BufferLoader,
  uniforms: CommonUniforms,
) {
  const loader = initializeGltfLoader();

  const scene = await (async () => {
    if (m.bin) {
      const bin = buf.removeU8(m.bin);
      if (!bin) {
        return;
      }

      const model = await loader.parseAsync(bin.buffer as ArrayBuffer, "");
      bin.set([]);
      return model.scene;
    } else {
      if (!m.material.url) {
        return;
      }
      const model = await loader.loadAsync(m.material.url);
      return model.scene;
    }
  })();

  if (!scene) {
    return;
  }

  const batchIdAndSelectedStatus = m.geometry.batch_id_and_selected_status;
  const dataSize = batchIdAndSelectedStatus?.size ?? 0;
  const batchIdAndSel = batchIdAndSelectedStatus
    ? buf.u32(batchIdAndSelectedStatus.data)
    : new Uint32Array(dataSize);

  scene.userData.batchIdAndSel = batchIdAndSel;
  scene.userData.dataSize = dataSize;
  scene.userData.isModel = true;

  if (batchIdAndSel) {
    const traverse = function (mesh: Object3D) {
      if (mesh instanceof Mesh) {
        const vertCnt = mesh.geometry.attributes?.position?.count;

        const attrBatchIdAndSel = new Float32Array(vertCnt * 2);
        const internalBatchIds = mesh.geometry.attributes?._batchid?.array;
        if (internalBatchIds) {
          for (let i = 0; i < internalBatchIds.length; i++) {
            const internalBatchId = internalBatchIds[i];
            attrBatchIdAndSel[i * 2] = batchIdAndSel[internalBatchId * 2] ?? 0;
            attrBatchIdAndSel[i * 2 + 1] =
              batchIdAndSel[internalBatchId * 2 + 1] ?? 0;
          }
        } else {
          for (let i = 0; i < vertCnt; i++) {
            attrBatchIdAndSel[i * 2] = batchIdAndSel[0];
            attrBatchIdAndSel[i * 2 + 1] = batchIdAndSel[1];
          }
        }

        mesh.geometry.setAttribute(
          "batchIdAndSel",
          new BufferAttribute(attrBatchIdAndSel, dataSize),
        );

        mesh.material.userData.uPickable = {
          value: 0.0,
        };

        mesh.material.color.set(m.material.color);
        mesh.material.metalness = m.material.metalness;
        mesh.material.roughness = m.material.roughness;

        mesh.material.onBeforeCompile = (shader: any) => {
          shader.uniforms.nvr_uHighlightColor = uniforms.highlightColor;
          shader.uniforms.nvr_uPickable = mesh.material.userData.uPickable;
          shader.vertexShader = shader.vertexShader.replace(
            "void main() {",
            `
                in vec2 batchIdAndSel;
                out vec2 nvr_vBatchIdAndSel;
  
                void main() {
                  nvr_vBatchIdAndSel = batchIdAndSel;
                `,
          );

          shader.fragmentShader = shader.fragmentShader
            .replace(
              "void main() {",
              `
                uniform vec3 nvr_uHighlightColor;
                uniform float nvr_uPickable;
                in vec2 nvr_vBatchIdAndSel;
                ${Pick}
                void main() {
                `,
            )
            .replace(
              "vec4 diffuseColor = vec4( diffuse, opacity );",
              `
                vec4 diffuseColor = vec4( diffuse, opacity );
                if(nvr_vBatchIdAndSel.y > 0.0) {
                  diffuseColor = vec4(nvr_uHighlightColor.xyz, 1.0);
                }
                `,
            )
            .replace(
              "#include <dithering_fragment>",
              `
                #include <dithering_fragment>
  
                if (nvr_uPickable > 0.0 && diffuseColor.a > 0.0) {
                  vec3 pickColor = nvr_batchIdToColor(nvr_vBatchIdAndSel.x);
                  gl_FragColor = vec4(pickColor.xyz, 1.0);
                }
                `,
            );
        };
      }

      if (Array.isArray(mesh.children) && mesh.children.length > 0) {
        mesh.children.forEach((child) => {
          traverse(child);
        });
      }
    };
    traverse(scene);
  }

  scene.visible = m.material.show ?? true;
  return scene;
}

export function processModelChanged(
  obj: Group,
  material: ModelMaterial,
  active: boolean,
) {
  obj.visible = (material.show ?? true) && active;

  const updateMaterial = function (m: any) {
    if (
      m instanceof MeshStandardMaterial ||
      m instanceof MeshPhysicalMaterial
    ) {
      m.color.set(material.color ?? 0);
      if (material.metalness != null) {
        m.metalness = material.metalness;
      }
      if (material.roughness != null) {
        m.roughness = material.roughness;
      }
    }
  };

  obj.traverse((object: Object3D) => {
    if (object instanceof Mesh) {
      const mesh = object as Mesh;

      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => {
            updateMaterial(m);
          });
        } else {
          updateMaterial(mesh.material);
        }
      }
    }
  });
}
