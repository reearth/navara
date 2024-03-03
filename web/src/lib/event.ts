import type {
  Events,
  Transform,
  MeshAdded,
  MeshChanged,
  ObjectEvent,
  Mesh as EventMesh,
  MeshMaterial as EventMaterial,
  ObjectTransformEvent,
} from "map-engine-prototype";
import {
  BufferAttribute,
  BufferGeometry,
  MeshStandardMaterial,
  type Camera,
  Mesh,
  type Object3D,
} from "three";

export type BufferLoader = {
  u8: (handle: number) => Uint8Array | null;
  f32: (handle: number) => Float32Array | null;
  u32: (handle: number) => Uint32Array | null;
};

export function processEvent(
  scene: Object3D,
  camera: Camera,
  meshes: Map<string, Mesh>,
  buf: BufferLoader,
  event: Events,
) {
  if (event.camera_transform_updated) {
    processCameraTransformUpdated(camera, event.camera_transform_updated);
  }
  event.object_transform_updated?.forEach(obj => processObjectTransformUpdated(meshes, obj));
  event.object_removed?.forEach(obj => processObjectRemoved(scene, meshes, obj));
  event.mesh_added?.forEach(mesh => processMeshAdded(scene, meshes, mesh, buf));
  event.mesh_updated?.forEach(mesh => processMeshChanged(scene, meshes, mesh, buf));
}

export function processCameraTransformUpdated(camera: Camera, transform: Transform) {
  setTransform(camera, transform);
}

export function processObjectTransformUpdated(meshes: Map<string, Mesh>, e: ObjectTransformEvent) {
  const id = `${e.ind}_${e.gen}`;
  const m = meshes.get(id);
  if (!m) return;

  setTransform(m, e.transform);
}

export function processMeshAdded(
  parent: Object3D,
  meshes: Map<string, Mesh>,
  mesh: MeshAdded,
  buf: BufferLoader,
) {
  createMesh(
    parent,
    meshes,
    buf,
    `${mesh.ind}_${mesh.gen}`,
    mesh.mesh,
    mesh.material,
    mesh.transform,
  );
}

export function processMeshChanged(
  parent: Object3D,
  meshes: Map<string, Mesh>,
  mesh: MeshChanged,
  buf: BufferLoader,
) {
  const id = `${mesh.ind}_${mesh.gen}`;
  const m = meshes.get(id);
  if (!m) return;

  meshes.delete(id);
  parent.remove(m);

  const newm = createMesh(parent, meshes, buf, id, mesh.mesh, mesh.material);
  if (!newm) return;

  newm.position.copy(m.position);
  newm.quaternion.copy(m.quaternion);
  newm.scale.copy(m.scale);
}

export function processObjectRemoved(
  parent: Object3D,
  meshes: Map<string, Mesh>,
  obj: ObjectEvent,
) {
  const id = `${obj.ind}_${obj.gen}`;
  const m = meshes.get(id);
  if (!m) return;

  meshes.delete(id);
  parent.remove(m);
}

export function createMesh(
  parent: Object3D,
  meshes: Map<string, Mesh>,
  buf: BufferLoader,
  id: string,
  mesh: EventMesh,
  _mat: EventMaterial,
  tranform?: Transform,
) {
  const position = buf.f32(mesh.vertices);
  const indices = buf.u32(mesh.indices);
  if (!position || !indices) return;

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(position, 3));
  const uv = buf.f32(mesh.uvs);
  if (uv) {
    geometry.setAttribute("uv", new BufferAttribute(uv, 2));
  }
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeVertexNormals();

  const material = new MeshStandardMaterial({ color: 0x00ff00 });
  const m = new Mesh(geometry, material);
  m.name = id;
  if (tranform) setTransform(m, tranform);

  parent.add(m);
  meshes.set(id, m);
  return m;
}

function setTransform(obj: Object3D, transform: Transform) {
  const { tx, ty, tz, qx, qy, qz, qw, sx, sy, sz } = transform;
  obj.position.set(tx, ty, tz);
  obj.quaternion.set(qx, qy, qz, qw);
  obj.scale.set(sx, sy, sz);
}
