import { generate_id_from_entity, to_globe_depth_id } from "@navara/core";
import {
  type Transform,
  type MeshAdded,
  type Mesh as EventMesh,
  type MeshMaterial as EventMaterial,
} from "navara";
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

import { toCreasedNormalsAsync } from "../helpers/toCreasedNormalsAsync";
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

// export function processMeshChanged(
//   parent: Object3D,
//   globeDepthScene: Object3D,
//   meshes: MeshCache,
//   mesh: MeshChanged,
//   buf: BufferLoader,
//   loadedTexes: Map<string, Texture>,
// ) {
//   const id = generate_id_from_entity(mesh);
//   const m = meshes.get(id);
//   if (!m) return;

//   meshes.delete(id);
//   parent.remove(m);

//   const globeDepthId = to_globe_depth_id(id);
//   const globeDepthMesh = meshes.get(globeDepthId);
//   if (globeDepthMesh) {
//     globeDepthScene.remove(globeDepthMesh);
//     meshes.delete(globeDepthId);
//   }

//   const newm = createMesh(
//     parent,
//     globeDepthScene,
//     meshes,
//     buf,
//     loadedTexes,
//     id,
//     mesh.mesh,
//     mesh.material,
//   );
//   if (!newm) return;

//   newm.position.copy(m.position);
//   newm.quaternion.copy(m.quaternion);
//   newm.scale.copy(m.scale);
// }

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
  const position = buf.f32(mesh.vertices);
  const indices = buf.u32(mesh.indices);
  if (!position || !indices) return;

  let geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(position, 3));
  const uv = buf.f32(mesh.uvs);
  if (uv) {
    geometry.setAttribute("uv", new BufferAttribute(uv, 2));
  }
  geometry.setIndex(new BufferAttribute(indices, 1));
  if (mat.should_compute_normal_from_vertex) {
    geometry = await toCreasedNormalsAsync(geometry, Math.PI / 3);
    // geometry.computeVertexNormals();
  }

  // const material = new MeshStandardMaterial({ color: 0x00ff00 });
  const material = toMaterial(mat, loadedTexes);
  const m = new Mesh(geometry, material);
  m.name = id;
  if (tranform) setTransform(m, tranform);

  parent.add(m);

  const clonedMesh = new Mesh(geometry, material);
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
): Material {
  if (mat.wireframe) {
    return new MeshBasicMaterial({
      color: mat.color,
      wireframe: true,
      stencilWrite: false,
    });
  }

  const m = mat.should_compute_normal_from_vertex
    ? new MeshLambertMaterial({ color: mat.color, stencilWrite: false })
    : new MeshBasicMaterial({
        color: mat.color,
        stencilWrite: false,
      });
  if (mat.texture_fragment) {
    const textureFragmentId = generate_id_from_entity(mat.texture_fragment);
    const t = loadedTexes.get(textureFragmentId);
    if (t) {
      m.map = t;
    }
  }

  return m;
}
