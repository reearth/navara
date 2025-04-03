import type { PointMesh, PointMaterial } from "@navara/engine";
import BatchDefinitioin from "@shaders/glsl/chunks/batch_definition.glsl";
import Pick from "@shaders/glsl/chunks/pick.glsl";
import PointFragShader from "@shaders/glsl/point.frag.glsl";
import { SpriteMaterial, Sprite } from "three";

import type { CommonUniforms } from "../../uniforms";

export async function renderPoint(m: PointMesh, uniforms: CommonUniforms) {
  const material = new SpriteMaterial({
    color: m.material.color,
    depthTest: m.material.depth_test,
    sizeAttenuation: !m.material.scale_by_distance,
    visible: m.material.show,
  });

  material.userData.uPickable = {
    value: 0.0,
  };

  const batchId = m.geometry.batch_id ?? 0;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.nvr_uBatchId = { value: batchId };
    shader.uniforms.nvr_uPickable = material.userData.uPickable;
    shader.vertexShader = shader.vertexShader
      .replace(
        "uniform vec2 center;",
        `
  uniform vec2 center;
  out vec2 sprite_uv;
  `,
      )
      .replace(
        "gl_Position = projectionMatrix * mvPosition;",
        `
  gl_Position = projectionMatrix * mvPosition;
  sprite_uv = position.xy;
  `,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "uniform float opacity;",
        `
  uniform float opacity;
  ${BatchDefinitioin}
  in vec2 sprite_uv;
  ${PointFragShader}
  ${Pick}
  `,
      )
      .replace(
        "#include <fog_fragment>",
        `
  #include <fog_fragment>
  float alpha = nvr_circle_alpha(sprite_uv);
  if (alpha == 0.) {
    discard;
  }
  
  gl_FragColor.a = alpha;
  
  if (nvr_uPickable > 0.0 && alpha > 0.0) {
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

export function processPointChanged(
  obj: Sprite,
  material: PointMaterial,
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
