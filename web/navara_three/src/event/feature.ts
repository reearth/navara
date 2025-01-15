import type {
  BillboardMesh,
  PointMesh,
  ModelMesh,
  PolylineMesh,
  RenderableFeature,
  PolygonMesh,
} from "@navara/engine";
import BranchFreeTernary from "@shaders/glsl/chunks/branchFreeTernary.glsl";
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
} from "three";

import type { CommonUniforms } from "../uniforms";

import { initializeGltfLoader, TEXTURE_LOADER } from "./loaders";

import type { BufferLoader, FeatureHandler } from ".";

export function renderFeature(
  bits: bigint,
  f: RenderableFeature,
  buf: BufferLoader,
  uniforms: CommonUniforms,
  featureHandler: FeatureHandler,
): Promise<Mesh | Sprite | Object3D | undefined> | undefined {
  if (f.point) {
    return renderPoint(f.point);
  }
  if (f.billboard) {
    return renderBillboard(f.billboard);
  }
  if (f.model) {
    return renderModel(bits, f.model, buf, featureHandler);
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
  material.onBeforeCompile = (shader) => {
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
in vec2 sprite_uv;
${PointFragShader}
`,
      )
      .replace(
        "#include <fog_fragment>",
        `
#include <fog_fragment>
gl_FragColor.a = nvr_circle_alpha(sprite_uv);
`,
      );
  };

  const sprite = new Sprite(material);
  sprite.center.set(m.material.center.x, m.material.center.y);

  let batchId = m.geometry.batch_id ?? 0;
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
  const sprite = new Sprite(material);
  sprite.center.set(m.material.center.x, m.material.center.y);

  let batchId = m.geometry.batch_id ?? 0;
  sprite.userData.batchId = batchId;
  sprite.userData.isPicked = false;
  sprite.userData.orgColor = m.material.color;

  return sprite;
}

async function renderModel(
  bits: bigint,
  m: ModelMesh,
  buf: BufferLoader,
  featureHandler: FeatureHandler,
) {
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

  let batchId = m.geometry.batch_id ?? 0;
  scene.userData.batchId = batchId;
  scene.userData.isPicked = false;
  scene.userData.orgColor = 0xffffff;

  scene.visible = m.material.show ?? true;
  featureHandler.markModelIsRendered(bits);
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
  let batchId = g.batch_id ? buf.f32(g.batch_id.data) : undefined;
  const batchIdSize = g.batch_id ? g.batch_id.size : 1;
  if (
    !position ||
    !start ||
    !forward_offset ||
    !start_normals ||
    !end_normal_and_texture_coordinate_normalization_x ||
    !right_normal_and_texture_coordinate_normalization_y ||
    !indices
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
  let isPicked = new Float32Array(position.length / g.position.size).fill(0);
  geometry.setAttribute("isPicked", new BufferAttribute(isPicked, 1));
  geometry.setIndex(new BufferAttribute(indices, 1));
  // geometry.computeVertexNormals();

  const [minHeight, maxHeight] = mesh.material.__internal__
    ?.min_max_heights ?? [0, 0];

  const material = new ShaderMaterial({
    uniforms: {
      minMaxHeightAndWidth: {
        value: [minHeight, maxHeight, mesh.material.width],
      },
      color: { value: new Color(mesh.material.color) },
      viewportAndPixelRatio: uniforms.viewportAndPixelRatio,
      frustumNearFar: uniforms.frustumNearFar,
      frustumRatio: uniforms.frustumRatio,
      tGlobeDepth: uniforms.tGlobeDepth,
      inverseProjectionMatrix: uniforms.inverseProjectionMatrix,
      pickable: { value: 0 },
      uHighlightColor : uniforms.highlightColor
    },
    vertexShader: PolylineVertShader,
    fragmentShader: mesh.material.clamp_to_ground
      ? GroundPolylineFragShader
      : PolylineFragShader,
    // fragmentShader: PolylineFragShader,
    depthTest: false,
    visible: mesh.material.show,
  });
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
  const indices = buf.u32(g.indices);
  let batchId = g.batch_id ? buf.f32(g.batch_id.data) : undefined;
  const batchIdSize = g.batch_id ? g.batch_id.size : 1;
  if (!position || !indices) return;

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

  let isPicked = new Float32Array(position.length / g.position.size).fill(0);
  geometry.setAttribute("isPicked", new BufferAttribute(isPicked, 1));
  geometry.setIndex(new BufferAttribute(indices, 1));

  const clampToGround = mesh.material.clamp_to_ground;
  // TODO: Need to calculate a shadow for a draped polygon by using terrain's normal.
  const material = new MeshLambertMaterial({
    color: mesh.material.color,
    wireframe: mesh.material.wireframe,
    stencilWrite: clampToGround,
  });

  // TODO: Update this value depends on the terrain updates.
  const uMinMaxHeights = mesh.material.__internal__?.min_max_heights;
  material.userData.uMinMaxHeight = {
    value: uMinMaxHeights,
  };
  material.userData.uClampToGround = {
    value: clampToGround,
  };

  material.onBeforeCompile = (shader) => {
    if (material.userData.uMinMaxHeight.value) {
      shader.uniforms.uMinMaxHeight = material.userData.uMinMaxHeight;
    }
    if (material.userData.uClampToGround.value) {
      shader.uniforms.uClampToGround = material.userData.uClampToGround;
    }

    shader.uniforms.uHighlightColor = uniforms.highlightColor;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `
#include <common>
attribute float isPicked;
in vec4 scaleNormalAndCap;

uniform vec2 uMinMaxHeight;
out float v_IsPicked;

${BranchFreeTernary}
`,
      )
      .replace(
        "#include <begin_vertex>",
        `
#include <begin_vertex>
transformed.xyz += scaleNormalAndCap.xyz * nvr_branchFreeTernary(scaleNormalAndCap.w == 0.0, uMinMaxHeight.x, uMinMaxHeight.y);
v_IsPicked = isPicked;
`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "uniform vec3 diffuse;",
        `
uniform vec3 diffuse;
uniform bool uClampToGround;
uniform vec3 uHighlightColor;
in float v_IsPicked;
`,
      )
      .replace(
        "#include <opaque_fragment>",
        `
if(uClampToGround) {
  gl_FragColor = diffuseColor;
} else {
  #include <opaque_fragment>
}

if(v_IsPicked > 0.5) {
  gl_FragColor = vec4(uHighlightColor.x, uHighlightColor.y, uHighlightColor.z, 1.0);
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
