import type {
  BillboardMesh,
  PointMesh,
  ModelMesh,
  PolylineMesh,
  RenderableFeature,
  PolygonMesh,
} from "@navara/engine";
import BranchFreeTernary from "@shaders/glsl/chunks/branchFreeTernary.glsl";
import Pick from "@shaders/glsl/chunks/pick.glsl";
import BatchDefinitioin from "@shaders/glsl/chunks/batch_definition.glsl";
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

import { isNumber } from "lodash-es";
import type { BufferLoader } from ".";

export function renderFeature(
  f: RenderableFeature,
  buf: BufferLoader,
  uniforms: CommonUniforms,
): Promise<Mesh | Sprite | Object3D | undefined> | undefined {
  if (f.point) {
    return renderPoint(f.point);
  }
  if (f.billboard) {
    return renderBillboard(f.billboard);
  }
  if (f.model) {
    return renderModel(f.model, buf);
  }
  if (f.polyline) {
    return renderPolyline(f.polyline, buf, uniforms);
  }
  if (f.polygon) {
    return renderPolygon(f.polygon, buf, uniforms);
  }
}

async function renderPoint(m: PointMesh) {
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
  sprite.center.set(m.material.center.x, m.material.center.y);

  sprite.userData.batchId = batchId;
  sprite.userData.isPicked = false;
  sprite.userData.orgColor = m.material.color;

  return sprite;
}

async function renderBillboard(m: BillboardMesh) {
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
  sprite.center.set(m.material.center.x, m.material.center.y);

  sprite.userData.batchId = batchId;
  sprite.userData.isPicked = false;
  sprite.userData.orgColor = m.material.color;

  return sprite;
}

async function renderModel(m: ModelMesh, buf: BufferLoader) {
  const loader = initializeGltfLoader();

  const scene = await (async () => {
    if (m.bin) {
      const bin = buf.u8(m.bin);
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

  scene.userData.batchId = 0;
  if (isNumber(m.geometry.global_batch_ids)) {
    scene.userData.batchId = buf.u32(m.geometry.global_batch_ids);
  }

  let globalBatchIds = m.geometry.global_batch_ids
    ? buf.u32(m.geometry.global_batch_ids)
    : undefined;
  globalBatchIds = globalBatchIds ?? new Uint32Array(1);

  if (scene.userData.batchId) {
    const traverse = function (mesh: Object3D) {
      if (mesh instanceof Mesh) {
        const vertCnt = mesh.geometry.attributes?.position?.count;
        const isPicked = new Float32Array(vertCnt).fill(0);

        const gBatchIds = new Float32Array(vertCnt).fill(globalBatchIds[0]);
        const internalBatchIds = mesh.geometry.attributes?._batchid?.array;
        if (internalBatchIds) {
          for (let i = 0; i < internalBatchIds.length; i++) {
            const internalBatchId = internalBatchIds[i];
            gBatchIds[i] = globalBatchIds[internalBatchId] ?? 0;
          }
        }

        mesh.geometry.setAttribute(
          "batchId",
          new BufferAttribute(gBatchIds, 1),
        );

        mesh.geometry.setAttribute(
          "isPicked",
          new BufferAttribute(isPicked, 1),
        );

        mesh.material.userData.uPickable = {
          value: 0.0,
        };

        mesh.material.userData.uHighlightColor = {
          value: new Color(0),
        };

        mesh.material.onBeforeCompile = (shader: any) => {
          shader.uniforms.nvr_uHighlightColor =
            mesh.material.userData.uHighlightColor;
          shader.uniforms.nvr_uPickable = mesh.material.userData.uPickable;
          shader.vertexShader = shader.vertexShader.replace(
            "void main() {",
            `
              attribute float isPicked;
              attribute float batchId;
              out float nvr_vBatchId;
              out float nvr_vIsPicked;
              void main() {
              nvr_vIsPicked = isPicked;
              nvr_vBatchId = batchId;
              `,
          );

          shader.fragmentShader = shader.fragmentShader
            .replace(
              "void main() {",
              `
              uniform vec3 nvr_uHighlightColor;
              uniform float nvr_uPickable;
              in float nvr_vIsPicked;
              in float nvr_vBatchId;
              ${Pick}
              void main() {
              `,
            )
            .replace(
              "vec4 diffuseColor = vec4( diffuse, opacity );",
              `
              vec4 diffuseColor = vec4( diffuse, opacity );
              if(nvr_vIsPicked > 0.0) {
                diffuseColor = vec4(nvr_uHighlightColor.xyz, 1.0);
              }
              `,
            )
            .replace(
              "#include <dithering_fragment>",
              `
              #include <dithering_fragment>

              if (nvr_uPickable > 0.0 && diffuseColor.a > 0.0) {
                vec3 pickColor = nvr_batchIdToColor(nvr_vBatchId);
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
  const position = buf.f32(g.position.data);
  const start = buf.f32(g.start.data);
  const forward_offset = buf.f32(g.forward_offset.data);
  const start_normals = buf.f32(g.start_normals.data);
  const end_normal_and_texture_coordinate_normalization_x = buf.f32(
    g.end_normal_and_texture_coordinate_normalization_x.data,
  );
  const right_normal_and_texture_coordinate_normalization_y = buf.f32(
    g.right_normal_and_texture_coordinate_normalization_y.data,
  );
  const indices = buf.u32(g.indices);
  const batchId = g.batch_id ? buf.f32(g.batch_id.data) : undefined;
  const batchIdSize = g.batch_id ? g.batch_id.size : 1;
  if (
    !position ||
    !start ||
    !forward_offset ||
    !start_normals ||
    !end_normal_and_texture_coordinate_normalization_x ||
    !right_normal_and_texture_coordinate_normalization_y ||
    !indices ||
    !batchId
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
  const isPicked = new Float32Array(position.length / g.position.size).fill(0);
  geometry.setAttribute("isPicked", new BufferAttribute(isPicked, 1));
  geometry.setAttribute("batchId", new BufferAttribute(batchId, batchIdSize));
  geometry.setIndex(new BufferAttribute(indices, 1));
  // geometry.computeVertexNormals();

  const [minHeight, maxHeight] = mesh.material.__internal__
    ?.min_max_heights ?? [0, 0];

  const uPickable = {
    value: 0.0,
  };

  const uHighlightColor = {
    value: new Color(0),
  };

  const material = new ShaderMaterial({
    uniforms: {
      ...UniformsLib["lights"],
      minMaxHeightAndWidth: {
        value: [minHeight, maxHeight, mesh.material.width],
      },
      color: { value: new Color(mesh.material.color) },
      viewportAndPixelRatio: uniforms.viewportAndPixelRatio,
      frustumNearFar: uniforms.frustumNearFar,
      frustumRatio: uniforms.frustumRatio,
      tGlobeDepth: uniforms.tGlobeDepth,
      uGlobeNormal: uniforms.tGlobeNormal,
      inverseProjectionMatrix: uniforms.inverseProjectionMatrix,
      nvr_uPickable: uPickable,
      nvr_uHighlightColor: uHighlightColor,
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
  material.userData.uHighlightColor = uHighlightColor;

  const m = new Mesh(geometry, material);
  m.userData.batchId = batchId;
  m.userData.batchIdSize = batchIdSize;

  return m;
}

async function renderPolygon(
  mesh: PolygonMesh,
  buf: BufferLoader,
  uniforms: CommonUniforms,
) {
  const g = mesh.geometry;
  const position = buf.f32(g.position.data);
  const normal = g.normal ? buf.f32(g.normal.data) : undefined;
  const scale_normal_and_cap = g.scale_normal_and_cap
    ? buf.f32(g.scale_normal_and_cap.data)
    : undefined;
  const extrudedHeight = g.extruded_height
    ? buf.f32(g.extruded_height.data)
    : undefined;
  const indices = buf.u32(g.indices);
  const batchId = g.batch_id ? buf.f32(g.batch_id.data) : undefined;
  const batchIdSize = g.batch_id ? g.batch_id.size : 1;
  if (!position || !indices || !batchId) return;

  const defines = {
    BATCHED_EXTRUDED_HEIGHT: false,
  };

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
  if (g.extruded_height && extrudedHeight) {
    geometry.setAttribute(
      "extrudedHeight",
      new BufferAttribute(extrudedHeight, g.extruded_height.size),
    );
    defines.BATCHED_EXTRUDED_HEIGHT = true;
  }

  const isPicked = new Float32Array(position.length / g.position.size).fill(0);
  geometry.setAttribute("isPicked", new BufferAttribute(isPicked, 1));

  geometry.setAttribute("batchId", new BufferAttribute(batchId, batchIdSize));

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
  material.userData.uPickable = {
    value: 0.0,
  };
  material.userData.uHighlightColor = {
    value: new Color(0),
  };

  material.defines = defines;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGlobeNormal = uniforms.tGlobeNormal;
    shader.uniforms.nvr_uPickable = material.userData.uPickable;
    if (material.userData.uMinMaxHeight.value) {
      shader.uniforms.uMinMaxHeight = material.userData.uMinMaxHeight;
    }
    if (material.userData.uClampToGround.value != null) {
      shader.uniforms.uClampToGround = material.userData.uClampToGround;
    }

    shader.uniforms.nvr_uHighlightColor = material.userData.uHighlightColor;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `
#include <common>
attribute float isPicked;
attribute float batchId;
in vec4 scaleNormalAndCap;

#if defined( BATCHED_EXTRUDED_HEIGHT )
in float extrudedHeight;
#endif

uniform vec2 uMinMaxHeight;
out float nvr_vBatchId;
out float nvr_vIsPicked;

${BranchFreeTernary}
`,
      )
      .replace(
        "#include <begin_vertex>",
        `
#include <begin_vertex>

#if defined( BATCHED_EXTRUDED_HEIGHT )
float maxHeight = max(uMinMaxHeight.y, extrudedHeight);
#else
float maxHeight = uMinMaxHeight.y;
#endif

transformed.xyz += scaleNormalAndCap.xyz * nvr_branchFreeTernary(scaleNormalAndCap.w == 0.0, uMinMaxHeight.x, maxHeight);

nvr_vIsPicked = isPicked;
nvr_vBatchId = batchId;
`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "uniform vec3 diffuse;",
        `
uniform vec3 diffuse;
uniform bool uClampToGround;
uniform sampler2D uGlobeNormal;
uniform vec3 nvr_uHighlightColor;
uniform float nvr_uPickable;
in float nvr_vIsPicked;
in float nvr_vBatchId;
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
if(nvr_vIsPicked > 0.0) {
  diffuseColor.xyz = nvr_uHighlightColor.xyz;
}
`,
      )
      // replace the last line of the fragment shader.
      .replace(
        "#include <dithering_fragment>",
        `
        #include <dithering_fragment>
  if (nvr_uPickable > 0.0 && diffuseColor.a > 0.0) {
    vec3 pickColor = nvr_batchIdToColor(nvr_vBatchId);
    gl_FragColor = vec4(pickColor.xyz, 1.0);
  }
`,
      );
  };

  const m = new Mesh(geometry, material);
  m.userData.draped = clampToGround;
  m.userData.batchId = batchId;
  m.userData.batchIdSize = batchIdSize;

  return m;
}
