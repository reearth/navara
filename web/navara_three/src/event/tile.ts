import {
  generate_id_from_entity,
  to_globe_gbuffer_id,
  to_globe_id,
} from "@navara/core";
import {
  type Transform,
  type MeshAdded,
  type Mesh as EventMesh,
  type RasterTileInternalMaterial,
  MeshChanged,
  TextureFragment,
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
  type MinificationTextureFilter,
  type MagnificationTextureFilter,
  Color,
} from "three";

import { generateMixOverlaidTexturesMacro } from "../material";
import type { Scenes } from "../scene";
import { toCreasedNormalsAsync } from "../tasks/toCreasedNormalsAsync";
import type { TextureOptions } from "../textures";
import type { MeshCache } from "../type";

import type { BufferLoader } from ".";

// TODO: Replace with one resource
const GLOBE_COLOR = 0xffffff;

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

export function processMeshChanged(
  meshes: MeshCache,
  mesh: MeshChanged,
  loadedTexes: Map<string, Texture>,
  textureOptions: TextureOptions,
) {
  const id = generate_id_from_entity(mesh);
  const m = meshes.get(to_globe_id(id));
  const mg = meshes.get(to_globe_gbuffer_id(id));
  if (!m || !mg) return;

  if (!(m instanceof Mesh) || !(mg instanceof Mesh)) return;
  if (!(m.material instanceof Material) || !(mg.material instanceof Material))
    return;

  const changedMaterial = mesh.material;
  const active = mesh.mesh.active;

  const maxTextures = textureOptions.maxTextures;

  // TODO: Support hide entire globe.
  m.visible = active;
  mg.visible = active;

  if (active) {
    setupTextureFragments(m.material, changedMaterial?.texture_fragments());
    setUniforms(m.material, changedMaterial, maxTextures);
    setupTextures(m.material, loadedTexes, textureOptions, maxTextures);
  }
}

async function createMesh(
  scenes: Scenes,
  meshes: MeshCache,
  buf: BufferLoader,
  loadedTexes: Map<string, Texture>,
  id: string,
  mesh: EventMesh,
  mat: RasterTileInternalMaterial,
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
  m.userData.tileOrigColor = GLOBE_COLOR;
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
  mat: RasterTileInternalMaterial,
  loadedTexes: Map<string, Texture>,
  textureOptions: TextureOptions,
): Material {
  if (mat.wireframe) {
    return new MeshBasicMaterial({
      color: GLOBE_COLOR,
      transparent: true,
      wireframe: true,
      stencilWrite: false,
    });
  }

  const m = mat.should_compute_normal_from_vertex
    ? new MeshLambertMaterial({
        color: GLOBE_COLOR,
        transparent: true,
        stencilWrite: false,
      })
    : new MeshBasicMaterial({
        color: GLOBE_COLOR,
        transparent: true,
        stencilWrite: false,
      });

  const maxTextures = textureOptions.maxTextures;

  setUniforms(m, mat, maxTextures);
  setupTextureFragments(m, mat.texture_fragments());
  setupTextures(m, loadedTexes, textureOptions, maxTextures);

  m.onBeforeCompile = (shader) => {
    shader.uniforms.uShows = m.userData.shows;
    shader.uniforms.uColors = m.userData.colors;
    shader.uniforms.uOpacities = m.userData.opacities;
    shader.uniforms.uTextures = m.userData.textures;
    // shader.uniforms.uTextures0 = { value: m.userData.textures.value[0] };
    // shader.uniforms.uTextures1 = { value: m.userData.textures.value[1] };

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `
uniform int uShows[${maxTextures}];
uniform vec3 uColors[${maxTextures}];
uniform float uOpacities[${maxTextures}];
uniform sampler2D uTextures[${maxTextures}];
// uniform sampler2D uTextures0;
// uniform sampler2D uTextures1;

#include <common>
`,
      )
      .replace(
        "#include <map_fragment>",
        `
${generateMixOverlaidTexturesMacro(maxTextures)}
diffuseColor = sampledDiffuseColor;
`,
      );
  };

  return m;
}

const setUniforms = (
  m: Material,
  mat: RasterTileInternalMaterial,
  maxTextures: number,
) => {
  if (!m.userData.shows) {
    m.userData.shows = {
      value: [...new Array(maxTextures)].fill(0),
    };
  }
  if (!m.userData.colors) {
    m.userData.colors = {
      value: [...new Array(maxTextures)].map(() => new Color()),
    };
  }
  if (!m.userData.opacities) {
    m.userData.opacities = {
      value: [...new Array(maxTextures)].fill(1),
    };
  }

  // Reset
  for (let i = 0; i < m.userData.shows.value.length; i++) {
    m.userData.shows.value[i] = 0;
    m.userData.colors.value[i] = new Color();
    m.userData.opacities.value[i] = 1;
  }

  // All properties have same length.
  const shows = mat.shows;
  const colors = mat.colors;
  const opacities = mat.opacities;
  for (let i = 0; i < shows.length; i++) {
    m.userData.shows.value[i] = shows[i];
    m.userData.colors.value[i] = new Color(colors[i]);
    m.userData.opacities.value[i] = opacities[i];
  }

  if (!m.defines) {
    m.defines = {
      USE_UV: true,
    };
  }
};

const setupTextureFragments = (
  m: Material,
  textureFragments: TextureFragment[] | undefined,
) => {
  if (!textureFragments) {
    return;
  }
  const texturesFragmentIds = [];
  for (const fragment of textureFragments) {
    texturesFragmentIds.push(
      fragment ? generate_id_from_entity(fragment) : null,
    );
  }

  m.userData.textureFragments = {
    value: texturesFragmentIds,
  };
};

const setupTextures = (
  m: Material,
  loadedTexes: Map<string, Texture>,
  textureOptions: TextureOptions,
  maxTextures: number,
) => {
  if (!m.userData.textures) {
    m.userData.textures = {
      value: [...new Array(maxTextures)].fill(null),
    };
  }

  // Reset
  for (let i = 0; i < maxTextures; i++) {
    m.userData.textures.value[i] = null;
  }

  const textureFragments = m.userData.textureFragments?.value;
  if (!textureFragments) {
    return;
  }

  if (textureFragments.length > maxTextures) {
    console.error(
      `Exceeded maximum textures: ${textureFragments.length} layers are provided. Maximum the number of textures is ${maxTextures}.`,
    );
  }

  const textures = m.userData.textures.value;
  for (let i = 0; i < textureFragments.length; i++) {
    const textureFragment = textureFragments[i];
    const t = textureFragment ? loadedTexes.get(textureFragment) : undefined;
    if (!t) {
      textures[i] = null;
      continue;
    }

    if (t.colorSpace !== SRGBColorSpace) {
      t.colorSpace = SRGBColorSpace;
      t.minFilter = textureOptions.minFilter as MinificationTextureFilter;
      t.magFilter = textureOptions.magFilter as MagnificationTextureFilter;
      t.anisotropy = textureOptions.maxAnisotropy;
      t.generateMipmaps = textureOptions.useMipmaps;
      t.needsUpdate = true;
    }

    textures[i] = t;
  }
};
