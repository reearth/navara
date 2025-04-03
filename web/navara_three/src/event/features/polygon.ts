import type { PolygonMesh, PolygonMaterial } from "@navara/engine";
import BranchFreeTernary from "@shaders/glsl/chunks/branchFreeTernary.glsl";
import Pick from "@shaders/glsl/chunks/pick.glsl";
import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  MeshLambertMaterial,
} from "three";

import type { BufferLoader } from "../";
import type { CommonUniforms } from "../../uniforms";

export async function renderPolygon(
  mesh: PolygonMesh,
  buf: BufferLoader,
  uniforms: CommonUniforms,
) {
  const g = mesh.geometry;
  const position = buf.removeF32(g.position.data);
  const normal = g.normal ? buf.removeF32(g.normal.data) : undefined;
  const scale_normal_and_cap = g.scale_normal_and_cap
    ? buf.removeF32(g.scale_normal_and_cap.data)
    : undefined;
  const indices = buf.removeU32(g.indices);
  const batchIdAndSel = g.batch_id_and_sel
    ? buf.removeF32(g.batch_id_and_sel.data)
    : undefined;
  const batchIdSize = g.batch_id_and_sel ? g.batch_id_and_sel.size : 0;
  const batchIndex = g.batch_index
    ? buf.removeU32(g.batch_index.data)
    : undefined;
  const batchIndexSize = g.batch_index ? g.batch_index.size : 0;
  if (!position || !indices || !batchIdAndSel || !batchIndex) return;

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(position, g.position.size),
  );
  if (g.normal && normal) {
    geometry.setAttribute("normal", new BufferAttribute(normal, g.normal.size));
  }
  if (g.scale_normal_and_cap && scale_normal_and_cap) {
    geometry.setAttribute(
      "scaleNormalAndCap",
      new BufferAttribute(scale_normal_and_cap, g.scale_normal_and_cap.size),
    );
  }

  geometry.setAttribute(
    "batchIdAndSel",
    new BufferAttribute(batchIdAndSel, batchIdSize),
  );
  // Align to B3DM attribute: https://github.com/CesiumGS/3d-tiles/blob/492adb06b00870d9ee99b8d97c261a466783034c/specification/TileFormats/Batched3DModel/README.adoc#binary-gltf
  // TODO: However this need to be migrated to v1.1 in the future
  geometry.setAttribute(
    "_batchid",
    new BufferAttribute(batchIndex, batchIndexSize),
  );

  geometry.setIndex(new BufferAttribute(indices, 1));

  const clampToGround = mesh.material.clamp_to_ground;
  // TODO: Need to calculate a shadow for a draped polygon by using terrain's normal.
  const material = new MeshLambertMaterial({
    color: mesh.material.color,
    wireframe: mesh.material.wireframe,
    stencilWrite: false,
    colorWrite: !clampToGround,
    depthWrite: !clampToGround,
    depthTest: !clampToGround,
    reflectivity: 0,
  });

  // TODO: Update this value depends on the terrain updates.
  const uMinMaxHeights = mesh.material.__internal__?.min_max_heights;
  material.userData.uMinMaxHeight = {
    value: uMinMaxHeights,
  };
  material.userData.uClampToGround = {
    value: clampToGround,
  };
  material.userData.useGroundNormals = {
    value: !!mesh.material.use_ground_normals,
  };
  material.userData.uPickable = {
    value: 0.0,
  };

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGlobeNormal = uniforms.tGlobeNormal;
    shader.uniforms.nvr_uPickable = material.userData.uPickable;
    shader.uniforms.useGroundNormals = material.userData.useGroundNormals;
    if (material.userData.uMinMaxHeight.value) {
      shader.uniforms.uMinMaxHeight = material.userData.uMinMaxHeight;
    }
    if (material.userData.uClampToGround.value != null) {
      shader.uniforms.uClampToGround = material.userData.uClampToGround;
    }

    shader.uniforms.nvr_uHighlightColor = uniforms.highlightColor;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `
  #include <common>
  in vec2 batchIdAndSel;
  in vec4 scaleNormalAndCap;
  
  uniform vec2 uMinMaxHeight;
  out vec2 nvr_vBatchIdAndSel;
  
  ${BranchFreeTernary}
  `,
      )
      .replace(
        "#include <begin_vertex>",
        `
  #include <begin_vertex>
  transformed.xyz += scaleNormalAndCap.xyz * nvr_branchFreeTernary(scaleNormalAndCap.w == 0.0, uMinMaxHeight.x, uMinMaxHeight.y);
  nvr_vBatchIdAndSel = batchIdAndSel;
  `,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "uniform vec3 diffuse;",
        `
  uniform vec3 diffuse;
  uniform bool uClampToGround;
  uniform bool useGroundNormals;
  uniform sampler2D uGlobeNormal;
  uniform vec3 nvr_uHighlightColor;
  uniform float nvr_uPickable;
  in vec2 nvr_vBatchIdAndSel;
  ${Pick}
  `,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `
  if(uClampToGround) {
    vec2 uv = gl_FragCoord.xy / vec2(textureSize(uGlobeNormal, 0));
    vec3 mapN = unpackRGBToNormal(texture2D( uGlobeNormal, uv ).xyz);
    // TODO: Support scaling normal. It's used to emphasis the shadow.
    // mapN.xy *= scaledNormal;
    normal = normalize( mapN );
  } else {
   #include <normal_fragment_maps>
  }
  `,
      )
      .replace(
        "vec4 diffuseColor = vec4( diffuse, opacity );",
        `
  vec4 diffuseColor = vec4( diffuse, opacity );
  if(nvr_vBatchIdAndSel.y > 0.0) {
    diffuseColor.xyz = nvr_uHighlightColor.xyz;
  }
  `,
      )
      .replace(
        "vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;",
        `
  vec3 outgoingLight;
  if(uClampToGround && !useGroundNormals) {
    // Without lighting
    outgoingLight = diffuseColor.xyz;
  } else {
    outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
  }
  `,
      )
      // replace the last line of the fragment shader.
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

  const m = new Mesh(geometry, material);
  m.userData.draped = clampToGround;
  m.userData.batchIdAndSel = batchIdAndSel;
  m.userData.batchIdSize = batchIdSize;

  return m;
}

export function processPolygonChanged(
  obj: Mesh,
  material: PolygonMaterial,
  active: boolean,
) {
  if (obj.material instanceof MeshLambertMaterial) {
    obj.material.color.set(material.color ?? 0);
    obj.visible = (material.show ?? true) && active;
    obj.material.wireframe = material.wireframe ?? false;
    obj.material.userData.uMinMaxHeight.value =
      material.__internal__?.min_max_heights;
    obj.material.userData.useGroundNormals.value =
      !!material.use_ground_normals;
    if (
      obj.material.userData.uClampToGround.value !== material.clamp_to_ground
    ) {
      obj.material.userData.uClampToGround.value = material.clamp_to_ground;
      // obj.material = obj.material.clone();
    }
    obj.userData.draped = material.clamp_to_ground;
  }
}
