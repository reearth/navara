import { generate_id_from_entity, to_globe_depth_id } from "@navara/core";
import {
  type Transform,
  type MeshAdded,
  type Mesh as EventMesh,
  type RasterTileMaterial as EventMaterial,
  MeshChanged,
} from "@navara/engine";
import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  MeshBasicMaterial,
  Material,
  MeshLambertMaterial,
  Object3D,
  Texture,
} from "three";

import { toCreasedNormalsAsync } from "../tasks/toCreasedNormalsAsync";
import type { MeshCache } from "../type";

import type { BufferLoader } from ".";

export async function processMeshAdded(
  parent: Object3D,
  globeDepthScene: Object3D,
  meshes: MeshCache,
  mesh: MeshAdded,
  buf: BufferLoader,
  loadedTexes: Map<string, Texture>,
) {
  await createMesh(
    parent,
    globeDepthScene,
    meshes,
    buf,
    loadedTexes,
    generate_id_from_entity(mesh),
    mesh.mesh,
    mesh.material,
    mesh.transform,
  );
}

export function processMeshChanged(meshes: MeshCache, mesh: MeshChanged) {
  const id = generate_id_from_entity(mesh);
  const m = meshes.get(id);
  if (!m) return;

  if (!(m instanceof Mesh)) return;
  if (!(m.material instanceof Material)) return;
  m.material.visible = !!mesh.material.show && mesh.mesh.active;
}

async function createMesh(
  parent: Object3D,
  globeDepthScene: Object3D,
  meshes: MeshCache,
  buf: BufferLoader,
  loadedTexes: Map<string, Texture>,
  id: string,
  mesh: EventMesh,
  mat: EventMaterial,
  tranform?: Transform,
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

  const material = toMaterial(mat, loadedTexes, false);
  const m = new Mesh(geometry, material);
  m.renderOrder = mesh.render_order;
  m.name = `tile_${id}`;
  if (tranform) setTransform(m, tranform);

  parent.add(m);

  const clonedMesh = m.clone();
  clonedMesh.renderOrder = mesh.render_order;
  m.name = `depth_tile_${id}`;
  globeDepthScene.add(clonedMesh);

  meshes.set(id, m);
  meshes.set(to_globe_depth_id(id), clonedMesh);
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
  active: boolean,
): Material {
  if (mat.wireframe) {
    return new MeshBasicMaterial({
      color: mat.color,
      opacity: mat.opacity,
      transparent: mat.opacity != null,
      wireframe: true,
      stencilWrite: false,
      visible: active,
    });
  }

  const m = mat.should_compute_normal_from_vertex
    ? new MeshLambertMaterial({
        color: mat.color,
        stencilWrite: false,
        opacity: mat.opacity,
        transparent: mat.opacity != null,
        visible: active,
      })
    : new MeshBasicMaterial({
        color: mat.color,
        opacity: mat.opacity,
        transparent: mat.opacity != null,
        stencilWrite: false,
        visible: active,
      });
  if (mat.__internal__?.texture_fragment) {
    const textureFragmentId = generate_id_from_entity(
      mat.__internal__.texture_fragment,
    );
    const t = loadedTexes.get(textureFragmentId);
    if (t) {
      m.map = t;
    }
  }

  return m;
}
