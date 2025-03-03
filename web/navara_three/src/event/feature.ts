import type {
  BillboardMesh,
  PointMesh,
  ModelMesh,
  PolylineMesh,
  RenderableFeature,
  PolygonMesh,
} from "@navara/engine";
import BatchDefinitioin from "@shaders/glsl/chunks/batch_definition.glsl";
import BranchFreeTernary from "@shaders/glsl/chunks/branchFreeTernary.glsl";
import Pick from "@shaders/glsl/chunks/pick.glsl";
import GroundPolylineFragShader from "@shaders/glsl/groundPolyline.frag.glsl";
import PointFragShader from "@shaders/glsl/point.frag.glsl";
import PolylineFragShader from "@shaders/glsl/polyline.frag.glsl";
import PolylineVertShader from "@shaders/glsl/polyline.vert.glsl";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  Object3D,
  MeshLambertMaterial,
  UniformsLib,
} from "three";

import type { CommonUniforms } from "../uniforms";

import { initializeGltfLoader, TEXTURE_LOADER } from "./loaders";

import type { BufferLoader } from ".";

export function renderFeature(
  f: RenderableFeature,
  buf: BufferLoader,
  uniforms: CommonUniforms,
): Promise<Mesh | Sprite | Object3D | undefined> | undefined {
  if (f.point) {
    return renderPoint(f.point, uniforms);
  }
  if (f.billboard) {
    return renderBillboard(f.billboard, uniforms);
  }
  if (f.model) {
    return renderModel(f.model, buf, uniforms);
  }
  if (f.polyline) {
    return renderPolyline(f.polyline, buf, uniforms);
  }
  if (f.polygon) {
    return renderPolygon(f.polygon, buf, uniforms);
  }
}

async function renderPoint(m: PointMesh, uniforms: CommonUniforms) {
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

async function renderBillboard(m: BillboardMesh, uniforms: CommonUniforms) {
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

async function renderModel(
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

      const model = await loader.parseAsync(bin.buffer, "");
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

async function renderPolyline(
  mesh: PolylineMesh,
  buf: BufferLoader,
  uniforms: CommonUniforms,
) {
  const g = mesh.geometry;
  const position = buf.removeF32(g.position.data);
  const start = buf.removeF32(g.start.data);
  const forward_offset = buf.removeF32(g.forward_offset.data);
  const start_normals = buf.removeF32(g.start_normals.data);
  const end_normal_and_texture_coordinate_normalization_x = buf.removeF32(
    g.end_normal_and_texture_coordinate_normalization_x.data,
  );
  const right_normal_and_texture_coordinate_normalization_y = buf.removeF32(
    g.right_normal_and_texture_coordinate_normalization_y.data,
  );
  const indices = buf.removeU32(g.indices);
  const batchIdAndSel = g.batch_id_and_sel
    ? buf.removeF32(g.batch_id_and_sel.data)
    : undefined;
  const batchIdSize = g.batch_id_and_sel ? g.batch_id_and_sel.size : 0;
  if (
    !position ||
    !start ||
    !forward_offset ||
    !start_normals ||
    !end_normal_and_texture_coordinate_normalization_x ||
    !right_normal_and_texture_coordinate_normalization_y ||
    !indices ||
    !batchIdAndSel
  )
    return;
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(position, g.position.size),
  );
  geometry.setAttribute("start", new BufferAttribute(start, g.start.size));
  geometry.setAttribute(
    "forward_offset",
    new BufferAttribute(forward_offset, g.forward_offset.size),
  );
  geometry.setAttribute(
    "start_normal",
    new BufferAttribute(start_normals, g.start_normals.size),
  );
  geometry.setAttribute(
    "end_normal_and_texture_coordinate_normalization_x",
    new BufferAttribute(
      end_normal_and_texture_coordinate_normalization_x,
      g.end_normal_and_texture_coordinate_normalization_x.size,
    ),
  );
  geometry.setAttribute(
    "right_normal_and_texture_coordinate_normalization_y",
    new BufferAttribute(
      right_normal_and_texture_coordinate_normalization_y,
      g.right_normal_and_texture_coordinate_normalization_y.size,
    ),
  );

  geometry.setAttribute(
    "batchIdAndSel",
    new BufferAttribute(batchIdAndSel, batchIdSize),
  );
  geometry.setIndex(new BufferAttribute(indices, 1));
  // geometry.computeVertexNormals();

  const [minHeight, maxHeight] = mesh.material.__internal__
    ?.min_max_heights ?? [0, 0];

  const uPickable = {
    value: 0.0,
  };

  const material = new ShaderMaterial({
    uniforms: {
      ...UniformsLib["lights"],
      minMaxHeightAndWidth: {
        value: [minHeight, maxHeight, mesh.material.width],
      },
      color: { value: new Color(mesh.material.color) },
      useGroundNormals: { value: !!mesh.material.use_ground_normals },
      viewportAndPixelRatio: uniforms.viewportAndPixelRatio,
      frustumNearFar: uniforms.frustumNearFar,
      frustumRatio: uniforms.frustumRatio,
      tGlobeDepth: uniforms.tGlobeDepth,
      uGlobeNormal: uniforms.tGlobeNormal,
      inverseProjectionMatrix: uniforms.inverseProjectionMatrix,
      nvr_uPickable: uPickable,
      nvr_uHighlightColor: uniforms.highlightColor,
    },
    vertexShader: PolylineVertShader,
    fragmentShader: mesh.material.clamp_to_ground
      ? GroundPolylineFragShader
      : PolylineFragShader,
    // fragmentShader: PolylineFragShader,
    depthTest: false,
    visible: mesh.material.show,
    lights: true,
  });

  material.userData.uPickable = uPickable;

  const m = new Mesh(geometry, material);
  m.userData.batchIdAndSel = batchIdAndSel;
  m.userData.batchIdSize = batchIdSize;

  return m;
}

async function renderPolygon(
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
  if (!position || !indices || !batchIdAndSel) return;

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
