import {
  type Events,
  type Transform,
  type MeshAdded,
  type MeshChanged,
  type EntityEvent,
  type Mesh as EventMesh,
  type MeshMaterial as EventMaterial,
  type ObjectTransformEvent,
  type DataRequestEvent,
  type RenderableFeatureAddedEvent,
  TextureFragmentRequestedEvent,
  TextureFragmentStatus,
  RenderableFeatureChangedEvent,
  PointMaterial,
  BillboardMaterial,
  ModelMaterial,
  PolylineMaterial,
  PolygonMaterial,
} from "navara";
import {
  BufferAttribute,
  BufferGeometry,
  // MeshStandardMaterial,
  type Camera,
  Mesh,
  MeshBasicMaterial,
  Material,
  TextureLoader,
  ImageLoader,
  MeshLambertMaterial,
  Object3D,
  Texture,
  Sprite,
  Group,
  ShaderMaterial,
} from "three";

import { applyTextureAspect } from "../texture";
import type { MeshCache } from "../type";
import type { CommonUniforms } from "../uniforms";

import { renderFeature } from "./feature";
import { generate_id_from_entity, to_globe_depth_id } from "./id";

export type BufferLoader = {
  u8: (handle: number) => Uint8Array | null;
  f32: (handle: number) => Float32Array | null;
  u32: (handle: number) => Uint32Array | null;
  setU8: (handle: number, bits: bigint, bytes: Uint8Array) => void;
  triggerDataRequesterFailed: (bits: bigint) => void;
};

export type TextureFragmentHandler = {
  triggerTextureFragmentLoaded: (
    bits: bigint,
    status: TextureFragmentStatus,
  ) => void;
};

export function processEvent(
  scene: Object3D,
  globeDepthScene: Object3D,
  camera: Camera,
  meshes: MeshCache,
  buf: BufferLoader,
  texFragment: TextureFragmentHandler,
  loadedTexs: Map<string, Texture>,
  tex: TextureLoader,
  event: Events,
  uniforms: CommonUniforms,
  drapedFeatureMaterials: Map<string, Material>,
) {
  if (event.camera_transform_updated) {
    processCameraTransformUpdated(camera, event.camera_transform_updated);
  }

  event.object_transform_updated?.forEach((obj) =>
    processObjectTransformUpdated(meshes, obj),
  );
  event.object_removed?.forEach((obj) => {
    processObjectRemoved(scene, meshes, obj);
    processObjectRemoved(globeDepthScene, meshes, obj, true);
  });
  event.mesh_added?.forEach((mesh) =>
    processMeshAdded(scene, globeDepthScene, meshes, mesh, buf, loadedTexs),
  );
  event.mesh_updated?.forEach((mesh) =>
    processMeshChanged(scene, globeDepthScene, meshes, mesh, buf, loadedTexs),
  );
  event.renderable_feature_added?.forEach((ev) =>
    processRenderableFeatureAdded(
      ev,
      scene,
      meshes,
      buf,
      uniforms,
      drapedFeatureMaterials,
    ),
  );
  event.renderable_feature_changed?.forEach((ev) =>
    processRenderableFeatureChanged(ev, meshes, drapedFeatureMaterials),
  );
  event.renderable_feature_removed?.forEach((ev) =>
    processObjectRemoved(scene, meshes, ev, undefined, drapedFeatureMaterials),
  );

  event.texture_fragment_requested?.forEach((req) =>
    processTextureFragmentRequested(req, texFragment, tex, loadedTexs),
  );
  event.data_requested?.forEach((req) => processRequestedData(req, buf));
  event.texture_fragment_removed?.forEach((req) =>
    processTextureFragmentRemoved(req, loadedTexs),
  );
}

function processCameraTransformUpdated(camera: Camera, transform: Transform) {
  setTransform(camera, transform); // disable temporarily
}

function processObjectTransformUpdated(
  meshes: MeshCache,
  e: ObjectTransformEvent,
) {
  const id = generate_id_from_entity(e);
  const m = meshes.get(id);
  const globeDepthMesh = meshes.get(to_globe_depth_id(id));
  if (m) {
    setTransform(m, e.transform);
  }

  if (globeDepthMesh) {
    setTransform(globeDepthMesh, e.transform);
  }
}

function processMeshAdded(
  parent: Object3D,
  globeDepthScene: Object3D,
  meshes: MeshCache,
  mesh: MeshAdded,
  buf: BufferLoader,
  loadedTexes: Map<string, Texture>,
) {
  createMesh(
    parent,
    globeDepthScene,
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
  globeDepthScene: Object3D,
  meshes: MeshCache,
  mesh: MeshChanged,
  buf: BufferLoader,
  loadedTexes: Map<string, Texture>,
) {
  const id = generate_id_from_entity(mesh);
  const m = meshes.get(id);
  if (!m) return;

  meshes.delete(id);
  parent.remove(m);

  const globeDepthId = to_globe_depth_id(id);
  const globeDepthMesh = meshes.get(globeDepthId);
  if (globeDepthMesh) {
    globeDepthScene.remove(globeDepthMesh);
    meshes.delete(globeDepthId);
  }

  const newm = createMesh(
    parent,
    globeDepthScene,
    meshes,
    buf,
    loadedTexes,
    id,
    mesh.mesh,
    mesh.material,
  );
  if (!newm) return;

  newm.position.copy(m.position);
  newm.quaternion.copy(m.quaternion);
  newm.scale.copy(m.scale);
}

function processObjectRemoved(
  parent: Object3D,
  meshes: MeshCache,
  obj: EntityEvent,
  isGlobeDepth?: boolean,
  drapedFeatureMaterials?: Map<string, Material>,
) {
  let id = generate_id_from_entity(obj);
  if (isGlobeDepth) {
    id = to_globe_depth_id(id);
  }
  const m = meshes.get(id);
  if (!m) return;

  meshes.delete(id);

  // Sprite, Mesh, and Group are all subclasses of Object3D
  if (m instanceof Object3D) {
    disposeObject3D(m);
  }

  drapedFeatureMaterials?.delete(id);

  // clear should after dispose, otherwise model's children will not be disposed
  m.clear();

  parent.remove(m);
}

function disposeObject3D(model: Object3D): void {
  model.traverse((object: Object3D) => {
    // model, polyline, polygon
    if (object instanceof Mesh) {
      const mesh = object as Mesh;

      // Dispose geometry
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }

      // Dispose material(s)
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((material) => {
            material.dispose();
          });
        } else {
          const material = mesh.material;
          material.dispose();
        }
      }
    }
    // point, billboard
    else if (object instanceof Sprite) {
      const sprite = object as Sprite;

      // Dispose material
      if (sprite.material) {
        if (Array.isArray(sprite.material)) {
          sprite.material.forEach((material) => {
            material.dispose();
          });
        } else {
          const material = sprite.material;
          material.dispose();
        }
      }
    }
  });
}

function processRequestedData(req: DataRequestEvent, buf: BufferLoader) {
  if (req.extension === "png") {
    const loader = new ImageLoader();
    loader
      .loadAsync(req.url)
      .then((img) => {
        // TODO: Get OffScreeCanvas from main thread in worker.
        const canvas = document.createElement("canvas");
        canvas.height = img.height;
        canvas.width = img.width;
        const context = canvas.getContext("2d");
        if (context === null) {
          throw new Error("failed to get context of canvas");
        } else {
          context.drawImage(img, 0, 0);
        }
        const data = context.getImageData(0, 0, img.height, img.width).data;
        if (data === undefined) {
          throw new Error("failed to convert array");
        } else {
          const u8a = new Uint8Array(data);
          buf.setU8(req.handle, req.bits, u8a);

          // Prevent memory leak
          u8a.set([]);
          data.set([]);
        }
        img.remove();
        canvas.remove();
      })
      .catch(() => {
        buf.triggerDataRequesterFailed(req.bits);
      });
    return;
  }

  fetch(req.url)
    .then((res) => res.arrayBuffer())
    .then((val) => {
      const bytes = new Uint8Array(val);
      buf.setU8(req.handle, req.bits, bytes);

      // Prevent memory leak
      bytes.set([]);
    });
}

function makeTextureFragmentId(ind: number, gen: number) {
  return `${ind}_${gen}`;
}

function processTextureFragmentRequested(
  req: TextureFragmentRequestedEvent,
  handler: TextureFragmentHandler,
  tex: TextureLoader,
  loadedTexes: Map<string, Texture>,
) {
  const id = makeTextureFragmentId(req.ind, req.gen);
  if (loadedTexes.has(id)) return;

  tex
    .loadAsync(req.url)
    .then((t) => {
      loadedTexes.set(id, t);
      handler.triggerTextureFragmentLoaded(
        req.bits,
        TextureFragmentStatus.Success,
      );
    })
    .catch(() => {
      handler.triggerTextureFragmentLoaded(
        req.bits,
        TextureFragmentStatus.Fail,
      );
    });
}

function processTextureFragmentRemoved(
  req: EntityEvent,
  loadedTexes: Map<string, Texture>,
) {
  const id = makeTextureFragmentId(req.ind, req.gen);
  loadedTexes.get(id)?.dispose();
  loadedTexes.delete(id);
}

async function processRenderableFeatureAdded(
  ev: RenderableFeatureAddedEvent,
  parent: Object3D,
  meshes: MeshCache,
  buf: BufferLoader,
  uniforms: CommonUniforms,
  drapedFeatureMaterials: Map<string, Material>,
) {
  const id = generate_id_from_entity(ev);
  const obj = await renderFeature(
    id,
    ev.feature,
    buf,
    uniforms,
    drapedFeatureMaterials,
  );
  if (!obj) return;

  const { point, billboard, polyline, polygon, model } = ev.feature;

  const transform = (point ?? billboard ?? polyline ?? polygon ?? model)
    ?.transform;
  if (transform) {
    setTransform(obj, transform);
  }
  applyTextureAspect(obj);

  obj.renderOrder = 1;

  parent.add(obj);

  meshes.set(id, obj);
}

// TODO: Update material in this function.
function processRenderableFeatureChanged(
  ev: RenderableFeatureChangedEvent,
  meshes: MeshCache,
  drapedFeatureMaterials: Map<string, Material>,
) {
  const id = generate_id_from_entity(ev);
  const obj = meshes.get(id);
  if (!obj) return;

  const { point, billboard, polyline, polygon, model } = ev.feature;

  const transform = (point ?? billboard ?? polyline ?? polygon ?? model)
    ?.transform;
  if (transform) {
    setTransform(obj, transform);
  }

  const material = (point ?? billboard ?? polyline ?? polygon ?? model)
    ?.material;
  if (material) {
    if (obj instanceof Sprite && material instanceof PointMaterial) {
      processPointChanged(obj, material);
    }
    if (obj instanceof Sprite && material instanceof BillboardMaterial) {
      processBillboardChanged(obj, material);
    }
    if (obj instanceof Group && material instanceof ModelMaterial) {
      processModelChanged(obj, material);
    }
    if (obj instanceof Mesh && material instanceof PolylineMaterial) {
      processPolylineChanged(obj, material);
    }
    if (obj instanceof Mesh && material instanceof PolygonMaterial) {
      processPolygonChanged(id, obj, material, drapedFeatureMaterials);
    }
  }

  applyTextureAspect(obj);

  obj.updateMatrix();
}

function processPointChanged(obj: Sprite, material: PointMaterial) {
  obj.material.color.set(material.color);
  obj.material.visible = material.show ?? true;
}

function processBillboardChanged(obj: Sprite, material: BillboardMaterial) {
  obj.material.color.set(material.color);
  obj.material.visible = material.show ?? true;
}

function processModelChanged(obj: Group, material: ModelMaterial) {
  obj.visible = material.show ?? true;
}

function processPolylineChanged(obj: Mesh, material: PolylineMaterial) {
  if (obj.material instanceof ShaderMaterial) {
    obj.material.uniforms.color.value.set(material.color);
    obj.material.uniforms.width.value = material.width;
    obj.material.visible = material.show ?? true;
  }
}

function processPolygonChanged(
  id: string,
  obj: Mesh,
  material: PolygonMaterial,
  drapedFeatureMaterials: Map<string, Material>,
) {
  if (obj.material instanceof MeshLambertMaterial) {
    obj.material.color.set(material.color);
    obj.material.visible = material.show ?? true;
    obj.material.userData.uMinMaxHeight.value =
      material.__internal__?.min_max_heights;
    if (
      obj.material.userData.uClampToGround.value !== material.clamp_to_ground
    ) {
      obj.material.userData.uClampToGround.value = material.clamp_to_ground;
      // obj.material = obj.material.clone();
    }
    if (material.clamp_to_ground) {
      obj.material.stencilWrite = true;
      drapedFeatureMaterials.set(id, obj.material);
    } else {
      obj.material.stencilWrite = false;
      drapedFeatureMaterials.delete(id);
    }
  }
}

function createMesh(
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

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(position, 3));
  const uv = buf.f32(mesh.uvs);
  if (uv) {
    geometry.setAttribute("uv", new BufferAttribute(uv, 2));
  }
  geometry.setIndex(new BufferAttribute(indices, 1));
  if (mat.should_compute_normal_from_vertex) {
    geometry.computeVertexNormals();
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

  const m = new MeshLambertMaterial({ color: mat.color, stencilWrite: false });
  if (mat.texture_fragment) {
    const textureFragmentId = makeTextureFragmentId(
      mat.texture_fragment.ind,
      mat.texture_fragment.gen,
    );
    const t = loadedTexes.get(textureFragmentId);
    if (t) {
      m.map = t;
    }
  }

  return m;
}
