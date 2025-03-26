import BatchDefinitioin from "@shaders/glsl/chunks/batch_definition.glsl";
import Pick from "@shaders/glsl/chunks/pick.glsl";
import { Sprite, SpriteMaterial } from "three";

import type { BillboardMesh, BillboardMaterial } from "@navara/engine";
import type { CommonUniforms } from "../../uniforms";
import { TEXTURE_LOADER } from "../loaders";

export async function renderBillboard(
  m: BillboardMesh,
  uniforms: CommonUniforms,
) {
  if (!m.material.url) return;
  const map = await TEXTURE_LOADER.loadAsync(m.material.url);

  const material = new SpriteMaterial({
    map: map,
    color: m.material.color,
    sizeAttenuation: !m.material.scale_by_distance,
    depthTest: m.material.depth_test,
    visible: m.material.show,
  });

  const batchId = m.geometry.batch_id ?? 0;
  material.userData.uPickable = {
    value: 0.0,
  };

  material.onBeforeCompile = (shader) => {
    shader.uniforms.nvr_uBatchId = { value: batchId };
    shader.uniforms.nvr_uPickable = material.userData.uPickable;

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <clipping_planes_pars_fragment>",
        `
        #include <clipping_planes_pars_fragment>
        ${BatchDefinitioin}
        ${Pick}
      `,
      )
      .replace(
        "#include <fog_fragment>",
        `
        #include <fog_fragment>
        if (nvr_uPickable > 0.0 && sampledDiffuseColor.a > 0.0) {
          vec3 pickColor = nvr_batchIdToColor(nvr_uBatchId);
          gl_FragColor = vec4(pickColor.xyz, 1.0);
        }
        `,
      );
  };

  const sprite = new Sprite(material);
  if (m.material.center) {
    sprite.center.set(m.material.center.x, m.material.center.y);
  }

  sprite.userData.batchId = batchId;
  sprite.userData.isPicked = false;
  sprite.userData.orgColor = m.material.color;

  if (m.geometry.selected && uniforms?.highlightColor?.value) {
    material.color.set(uniforms.highlightColor.value);
    sprite.userData.isPicked = true;
  }

  return sprite;
}

export function processBillboardChanged(
  obj: Sprite,
  material: BillboardMaterial,
  active: boolean,
) {
  obj.userData.orgColor = material.color;
  if (!obj.userData.isPicked) {
    obj.material.color.set(material.color ?? 0);
  }
  obj.visible = (material.show ?? true) && active;

  obj.material.sizeAttenuation = !material.scale_by_distance;
  obj.material.needsUpdate = true;
}
