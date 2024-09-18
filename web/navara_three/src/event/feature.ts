import GroundPolylineFragShader from "@shaders/glsl/groundPolyline.frag.glsl";
import PointFragShader from "@shaders/glsl/point.frag.glsl";
import PolylineFragShader from "@shaders/glsl/polyline.frag.glsl";
import PolylineVertShader from "@shaders/glsl/polyline.vert.glsl";
import type { BillboardMesh, PointMesh, ModelMesh, PolylineMesh, RenderableFeature } from "navara";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  TextureLoader,
  Object3D,
} from "three";
import { GLTFLoader } from "three-stdlib";

import type { CommonUniforms } from "../uniforms";

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
    return renderModel(f.model);
  }
  if (f.polyline) {
    return renderPolyline(f.polyline, buf, uniforms);
  }
}

async function renderPoint(m: PointMesh) {
  const material = new SpriteMaterial({
    color: m.material.color,
    depthTest: m.material.depth_test,
    sizeAttenuation: false,
    visible: m.material.show,
  });
  material.onBeforeCompile = shader => {
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

  return sprite;
}

async function renderBillboard(m: BillboardMesh) {
  const map = await new TextureLoader().loadAsync(m.material.url);

  const material = new SpriteMaterial({
    map: map,
    color: m.material.color,
    sizeAttenuation: false,
    depthTest: m.material.depth_test,
    visible: m.material.show,
  });
  const sprite = new Sprite(material);
  sprite.center.set(m.material.center.x, m.material.center.y);

  return sprite;
}

async function renderModel(m: ModelMesh) {
  const loader = new GLTFLoader();

  const model = await loader.loadAsync(m.material.url);

  return model.scene;
}

async function renderPolyline(mesh: PolylineMesh, buf: BufferLoader, uniforms: CommonUniforms) {
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
  geometry.setAttribute("position", new BufferAttribute(position, g.position.size));
  geometry.setAttribute("start", new BufferAttribute(start, g.start.size));
  geometry.setAttribute(
    "forward_offset",
    new BufferAttribute(forward_offset, g.forward_offset.size),
  );
  geometry.setAttribute("start_normal", new BufferAttribute(start_normals, g.start_normals.size));
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
  geometry.setIndex(new BufferAttribute(indices, 1));
  // geometry.computeVertexNormals();

  const material = new ShaderMaterial({
    uniforms: {
      width: { value: mesh.material.width },
      color: { value: new Color(mesh.material.color) },
      viewportAndPixelRatio: uniforms.viewportAndPixelRatio,
      frustumNearFar: uniforms.frustumNearFar,
      frustumRatio: uniforms.frustumRatio,
      tGlobeDepth: uniforms.tGlobeDepth,
      inverseProjectionMatrix: uniforms.inverseProjectionMatrix,
    },
    vertexShader: PolylineVertShader,
    fragmentShader: mesh.material.clamp_to_ground ? GroundPolylineFragShader : PolylineFragShader,
    depthTest: false,
    depthWrite: false,
  });
  const m = new Mesh(geometry, material);

  return m;
}
