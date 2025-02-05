import {
  generate_id_from_entity,
  to_globe_gbuffer_id,
  to_globe_id,
} from "@navara/core";
import {
  type Transform,
  type MeshAdded,
  type Mesh as EventMesh,
  type RasterTileMaterial as EventMaterial,
  MeshChanged,
} from "@navara/engine";
import GBufferGlobeFragShader from "@shaders/glsl/gbufferGlobe.frag.glsl";
import GBufferGlobeVertShader from "@shaders/glsl/gbufferGlobe.vert.glsl";
import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  MeshBasicMaterial,
  Material,
  MeshLambertMaterial,
  Object3D,
  Texture,
  RawShaderMaterial,
  GLSL3,
  SRGBColorSpace,
  LinearFilter,
} from "three";

import type { Scenes } from "../scene";
import { toCreasedNormalsAsync } from "../tasks/toCreasedNormalsAsync";
import type { TextureOptions } from "../textures";
import type { MeshCache } from "../type";

import type { BufferLoader } from ".";

export async function processMeshAdded(
  scenes: Scenes,
  meshes: MeshCache,
  mesh: MeshAdded,
  buf: BufferLoader,
  loadedTexes: Map<string, Texture>,
  textureOptions: TextureOptions,
) {
  await createMesh(
    scenes,
    meshes,
    buf,
    loadedTexes,
    generate_id_from_entity(mesh),
    mesh.mesh,
    mesh.material,
    mesh.transform,
    textureOptions,
  );
}

export function processMeshChanged(meshes: MeshCache, mesh: MeshChanged) {
  const id = generate_id_from_entity(mesh);
  const m = meshes.get(to_globe_id(id));
  const mg = meshes.get(to_globe_gbuffer_id(id));
  if (!m || !mg) return;

  if (!(m instanceof Mesh) || !(mg instanceof Mesh)) return;
  if (!(m.material instanceof Material) || !(mg.material instanceof Material))
    return;
  m.visible = !!mesh.material.show && mesh.mesh.active;
  mg.visible = !!mesh.material.show && mesh.mesh.active;
}

async function createMesh(
  scenes: Scenes,
  meshes: MeshCache,
  buf: BufferLoader,
  loadedTexes: Map<string, Texture>,
  id: string,
  mesh: EventMesh,
  mat: EventMaterial,
  tranform: Transform | undefined,
  textureOptions: TextureOptions,
) {
  let position = buf.f32(mesh.vertices);
  let indices = buf.u32(mesh.indices);
  if (!position || !indices) return;

  let geometry = new BufferGeometry();

  geometry.setAttribute("position", new BufferAttribute(position, 3));
  position.set([]);
  position = null;

  let uv = buf.f32(mesh.uvs);
  if (uv) {
    geometry.setAttribute("uv", new BufferAttribute(uv, 2));
    uv.set([]);
    uv = null;
  }

  geometry.setIndex(new BufferAttribute(indices, 1));
  indices.set([]);
  indices = null;

  if (mat.should_compute_normal_from_vertex) {
    geometry = await toCreasedNormalsAsync(geometry, Math.PI / 3);
  }

  const material = toMaterial(mat, loadedTexes, textureOptions);
  const m = new Mesh(geometry, material);
  m.visible = false;
  m.renderOrder = mesh.render_order;
  m.name = `tile_${id}`;
  if (tranform) setTransform(m, tranform);
  scenes.globe.add(m);
  meshes.set(to_globe_id(id), m);

  const gbufferMaterial = new RawShaderMaterial({
    vertexShader: GBufferGlobeVertShader,
    fragmentShader: GBufferGlobeFragShader,
    glslVersion: GLSL3,
  });
  const gbufferMesh = new Mesh(geometry, gbufferMaterial);
  gbufferMesh.visible = false;
  scenes.globeGBuffer.add(gbufferMesh);
  meshes.set(to_globe_gbuffer_id(id), gbufferMesh);

  return m;
}

function setTransform(obj: Object3D, transform: Transform) {
  const { tx, ty, tz, qx, qy, qz, qw, sx, sy, sz } = transform;
  obj.position.set(tx, ty, tz);
  obj.quaternion.set(qx, qy, qz, qw);
  obj.scale.set(sx, sy, sz);
}

function toMaterial(
  mat: EventMaterial,
  loadedTexes: Map<string, Texture>,
  textureOptions: TextureOptions,
): Material {
  const transparent = mat.opacity != null && mat.opacity !== 1;
  if (mat.wireframe) {
    return new MeshBasicMaterial({
      color: mat.color,
      opacity: mat.opacity,
      transparent,
      wireframe: true,
      stencilWrite: false,
    });
  }

  const m = mat.should_compute_normal_from_vertex
    ? new MeshLambertMaterial({
        color: mat.color,
        stencilWrite: false,
        opacity: mat.opacity,
        transparent,
      })
    : new MeshBasicMaterial({
        color: mat.color,
        opacity: mat.opacity,
        transparent,
        stencilWrite: false,
      });
  if (mat.__internal__?.texture_fragment) {
    const textureFragmentId = generate_id_from_entity(
      mat.__internal__.texture_fragment,
    );
    const t = loadedTexes.get(textureFragmentId);
    if (t) {
      t.colorSpace = SRGBColorSpace;
      t.minFilter = LinearFilter;
      t.generateMipmaps = false;
      t.anisotropy = textureOptions.maxAnisotropy;
      t.needsUpdate = true;

      m.map = t;
    }
  }

  return m;
}
