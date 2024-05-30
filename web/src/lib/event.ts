import {
  type Events,
  type Transform,
  type MeshAdded,
  type MeshChanged,
  type ObjectEvent,
  type Mesh as EventMesh,
  type MeshMaterial as EventMaterial,
  type ObjectTransformEvent,
  type DataRequestEvent,
  TextureFragmentRequestedEvent,
  TextureFragmentStatus,
  TextureFragmentRemovedEvent,
} from "navara";
import {
  BufferAttribute,
  BufferGeometry,
  // MeshStandardMaterial,
  type Camera,
  Mesh,
  type Object3D,
  MeshBasicMaterial,
  Material,
  TextureLoader,
  ImageLoader,
  MeshLambertMaterial,
  Texture,
} from "three";

export type BufferLoader = {
  u8: (handle: number) => Uint8Array | null;
  f32: (handle: number) => Float32Array | null;
  u32: (handle: number) => Uint32Array | null;
  setU8: (handle: number, bytes: Uint8Array) => void;
};

export type TextureFragmentHandler = {
  triggerTextureFragmentLoaded: (bits: bigint, status: TextureFragmentStatus) => void;
};

export function processEvent(
  scene: Object3D,
  camera: Camera,
  meshes: Map<string, Mesh>,
  buf: BufferLoader,
  texFragment: TextureFragmentHandler,
  loadedTexs: Map<string, Texture>,
  tex: TextureLoader,
  event: Events,
) {
  if (event.camera_transform_updated) {
    processCameraTransformUpdated(camera, event.camera_transform_updated);
  }
  event.object_transform_updated?.forEach(obj => processObjectTransformUpdated(meshes, obj));
  event.object_removed?.forEach(obj => processObjectRemoved(scene, meshes, obj));
  event.mesh_added?.forEach(mesh => processMeshAdded(scene, meshes, mesh, buf, loadedTexs));
  event.mesh_updated?.forEach(mesh => processMeshChanged(scene, meshes, mesh, buf, loadedTexs));
  event.data_requested?.forEach(req => processRequestedData(req, buf));
  event.texture_fragment_requested?.forEach(req => processTextureFragmentRequested(req, texFragment, tex, loadedTexs));
  event.texture_fragment_removed?.forEach(req => processTextureFragmentRemoved(req, loadedTexs));
}

function processCameraTransformUpdated(camera: Camera, transform: Transform) {
  setTransform(camera, transform); // disable temporarily
}

function processObjectTransformUpdated(meshes: Map<string, Mesh>, e: ObjectTransformEvent) {
  const id = `${e.ind}_${e.gen}`;
  const m = meshes.get(id);
  if (!m) return;

  setTransform(m, e.transform);
}

function processMeshAdded(
  parent: Object3D,
  meshes: Map<string, Mesh>,
  mesh: MeshAdded,
  buf: BufferLoader,
  loadedTexes: Map<string, Texture>
) {
  createMesh(
    parent,
    meshes,
    buf,
    loadedTexes,
    `${mesh.ind}_${mesh.gen}`,
    mesh.mesh,
    mesh.material,
    mesh.transform,
  );
}

function processMeshChanged(
  parent: Object3D,
  meshes: Map<string, Mesh>,
  mesh: MeshChanged,
  buf: BufferLoader,
  loadedTexes: Map<string, Texture>
) {
  const id = `${mesh.ind}_${mesh.gen}`;
  const m = meshes.get(id);
  if (!m) return;

  meshes.delete(id);
  parent.remove(m);

  const newm = createMesh(parent, meshes, buf, loadedTexes, id, mesh.mesh, mesh.material);
  if (!newm) return;

  newm.position.copy(m.position);
  newm.quaternion.copy(m.quaternion);
  newm.scale.copy(m.scale);
}

function processObjectRemoved(parent: Object3D, meshes: Map<string, Mesh>, obj: ObjectEvent) {
  const id = `${obj.ind}_${obj.gen}`;
  const m = meshes.get(id);
  if (!m) return;

  meshes.delete(id);
  parent.remove(m);
}

function processRequestedData
  ( req: DataRequestEvent,
    buf: BufferLoader,
  ){
  console.log("Requested data", req.handle, req.url);
  const loader = new ImageLoader();
  loader.load(
    req.url,
    (img) => {
      const canvas = document.createElement('canvas');
      canvas.height = img.height
      canvas.width = img.width
      const context = canvas.getContext('2d');
      if(context === null) {
        throw new Error('failed to get context of canvas');
      }else{
        context.drawImage(img, 0, 0);
      }
      const data = context.getImageData(0, 0, img.height, img.width).data;
      if(data === undefined){
        throw new Error('failed to convert array');
      }else{
        buf.setU8(req.handle, new Uint8Array(data));
      }
    }
  )
}

function makeTextureFragmentId(ind: number, gen: number) {
  return `${ind}_${gen}`;
}

function processTextureFragmentRequested
  ( req: TextureFragmentRequestedEvent,
    handler: TextureFragmentHandler,
    tex: TextureLoader,
    loadedTexes: Map<string, Texture>,
  ){
  const id = makeTextureFragmentId(req.ind, req.gen);
  if(loadedTexes.has(id)) return;

  tex.loadAsync(req.url).then((t) => {
    loadedTexes.set(id, t);
    handler.triggerTextureFragmentLoaded(req.bits, TextureFragmentStatus.Sucess);
  }).catch(() => {
    handler.triggerTextureFragmentLoaded(req.bits, TextureFragmentStatus.Fail);
  });
}

function processTextureFragmentRemoved
  ( req: TextureFragmentRemovedEvent,
    loadedTexes: Map<string, Texture>,
  ){
  const id = makeTextureFragmentId(req.ind, req.gen);
  loadedTexes.get(id)?.dispose();
  loadedTexes.delete(id);
}

function createMesh(
  parent: Object3D,
  meshes: Map<string, Mesh>,
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

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(position, 3));
  const uv = buf.f32(mesh.uvs);
  if (uv) {
    geometry.setAttribute("uv", new BufferAttribute(uv, 2));
  }
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeVertexNormals();

  // const material = new MeshStandardMaterial({ color: 0x00ff00 });
  const material = toMaterial(mat, loadedTexes);
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

function toMaterial(mat: EventMaterial, loadedTexes: Map<string, Texture>): Material {
  if (mat.wireframe) {
    return new MeshBasicMaterial({ color: mat.color, wireframe: true });
  }

  const m = new MeshLambertMaterial({ color: mat.color });
  if (mat.map_url && mat.texture_fragment) {
    const textureFragmentId = makeTextureFragmentId(mat.texture_fragment.ind, mat.texture_fragment.gen);
    const t = loadedTexes.get(textureFragmentId);
    if(t) {
      m.map = t;
    }
  }

  return m;
}
