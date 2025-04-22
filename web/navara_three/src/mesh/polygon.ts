import {
  PolygonMesh as NavaraPolygonMesh,
  PolygonMaterial,
} from "@navara/engine";
import BatchTextureParsVertex from "@shaders/glsl/chunks/batch_texture_pars_vertex.glsl";
import BatchTextureVertex from "@shaders/glsl/chunks/batch_texture_vertex.glsl";
import BranchFreeTernary from "@shaders/glsl/chunks/branchFreeTernary.glsl";
import ExtrudedHeightParsVertex from "@shaders/glsl/chunks/extruded_height_pars_vertex.glsl";
import ExtrudedHeightVertex from "@shaders/glsl/chunks/extruded_height_vertex.glsl";
import Pick from "@shaders/glsl/chunks/pick.glsl";
import ShowFragment from "@shaders/glsl/chunks/show_fragment.glsl";
import ShowParsFragment from "@shaders/glsl/chunks/show_pars_fragment.glsl";
import ShowParsVertex from "@shaders/glsl/chunks/show_pars_vertex.glsl";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  MeshLambertMaterial,
} from "three";

import type { BufferLoader } from "../event";
import type { CommonUniforms } from "../uniforms";
import { createReplacer } from "../utils";

import {
  BatchedFeatureMesh,
  type BatchedFeatureAttributes,
} from "./batchedFeature";

type Attributes = BatchedFeatureAttributes<{
  position: BufferAttribute;
  normal: BufferAttribute;
  scaleNormalAndCap: BufferAttribute;
  batchIdAndSel: BufferAttribute;
}>;

export class PolygonMesh extends BatchedFeatureMesh<
  BufferGeometry<Attributes>,
  MeshLambertMaterial
> {
  constructor(
    mesh: NavaraPolygonMesh,
    buf: BufferLoader,
    uniforms: CommonUniforms,
  ) {
    super(new BufferGeometry<Attributes>(), new MeshLambertMaterial());
    this.initGeometry(mesh, buf);
    this.initMaterial(mesh, uniforms);
  }

  private initGeometry(mesh: NavaraPolygonMesh, buf: BufferLoader) {
    const g = mesh.geometry;
    const position = buf.removeF32(g.position.data);
    const normal = g.normal ? buf.removeF32(g.normal.data) : undefined;
    const scale_normal_and_cap = g.scale_normal_and_cap
      ? buf.removeF32(g.scale_normal_and_cap.data)
      : undefined;
    const indices = buf.removeU32(g.indices);
    const batchIdAndSel = g.batch_id_and_sel
      ? buf.removeF32(g.batch_id_and_sel.data)
      : undefined;
    const batchIdSize = g.batch_id_and_sel ? g.batch_id_and_sel.size : 0;
    const batchIndex = g.batch_index
      ? buf.removeU32(g.batch_index.data)
      : undefined;
    const batchIndexSize = g.batch_index ? g.batch_index.size : 0;
    if (!position || !indices) return;

    const geometry = this.geometry;
    geometry.setAttribute(
      "position",
      new BufferAttribute(position, g.position.size),
    );
    if (g.normal && normal) {
      geometry.setAttribute(
        "normal",
        new BufferAttribute(normal, g.normal.size),
      );
    }
    if (g.scale_normal_and_cap && scale_normal_and_cap) {
      geometry.setAttribute(
        "scaleNormalAndCap",
        new BufferAttribute(scale_normal_and_cap, g.scale_normal_and_cap.size),
      );
    }

    if (batchIdAndSel) {
      geometry.setAttribute(
        "batchIdAndSel",
        new BufferAttribute(batchIdAndSel, batchIdSize),
      );
    }

    if (batchIndex) {
      this._setBatchIndex(Float32Array.from(batchIndex), batchIndexSize);
    }

    geometry.setIndex(new BufferAttribute(indices, 1));

    this.userData.batchIdAndSel = batchIdAndSel;
    this.userData.batchIdSize = batchIdSize;
  }

  private initMaterial(mesh: NavaraPolygonMesh, uniforms: CommonUniforms) {
    const meshMaterial = mesh.material;
    const mcolor = meshMaterial.color;

    const clampToGround = meshMaterial.clamp_to_ground;
    const material = this.material;
    material.color.set(mcolor ?? 0);
    material.wireframe = !!meshMaterial.wireframe;
    material.stencilWrite = false;
    material.colorWrite = !clampToGround;
    material.depthWrite = !clampToGround;
    material.depthTest = !clampToGround;
    material.reflectivity = 0;
    material.vertexColors = false;

    material.userData.color = mcolor;

    const uMinMaxHeights = meshMaterial.__internal__?.min_max_heights;
    material.userData.uMinMaxHeight = {
      value: uMinMaxHeights,
    };
    material.userData.uAddExtrudedHeight = {
      value: 0.0,
    };
    material.userData.uClampToGround = {
      value: clampToGround,
    };
    material.userData.useGroundNormals = {
      value: !!meshMaterial.use_ground_normals,
    };
    material.userData.uPickable = {
      value: 0.0,
    };

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uGlobeNormal = uniforms.tGlobeNormal;
      shader.uniforms.nvr_uPickable = material.userData.uPickable;
      shader.uniforms.useGroundNormals = material.userData.useGroundNormals;
      if (material.userData.uMinMaxHeight.value) {
        shader.uniforms.uMinMaxHeight = material.userData.uMinMaxHeight;
      }
      shader.uniforms.uAddExtrudedHeight = material.userData.uAddExtrudedHeight;
      if (material.userData.uClampToGround.value != null) {
        shader.uniforms.uClampToGround = material.userData.uClampToGround;
      }

      if (material.userData.batchDataTexture) {
        shader.uniforms.batchDataTexture = material.userData.batchDataTexture;
      }

      shader.uniforms.nvr_uHighlightColor = uniforms.highlightColor;

      // Use Replacer for method chaining (with side-effect free implementation)
      shader.vertexShader = createReplacer(shader.vertexShader)
        .replace(
          "#include <common>",
          `
  #include <common>
  in vec2 batchIdAndSel;
  in vec4 scaleNormalAndCap;
  
  uniform vec2 uMinMaxHeight;
  out vec2 nvr_vBatchIdAndSel;
  
  ${ShowParsVertex}
  ${ExtrudedHeightParsVertex}
  ${BatchTextureParsVertex}
  
  ${BranchFreeTernary}
  `,
        )
        .replace(
          "#include <begin_vertex>",
          `
  #include <begin_vertex>

  ${ExtrudedHeightVertex}
  ${BatchTextureVertex}

  transformed.xyz += scaleNormalAndCap.xyz * nvr_branchFreeTernary(scaleNormalAndCap.w == 0.0, uMinMaxHeight.x, uMinMaxHeight.y + addExtrudedHeight);

  nvr_vBatchIdAndSel = batchIdAndSel;
  `,
        ).source;

      shader.fragmentShader = createReplacer(shader.fragmentShader)
        .replace(
          "uniform vec3 diffuse;",
          `
  uniform vec3 diffuse;
  uniform bool uClampToGround;
  uniform bool useGroundNormals;
  uniform sampler2D uGlobeNormal;
  uniform vec3 nvr_uHighlightColor;
  uniform float nvr_uPickable;
  in vec2 nvr_vBatchIdAndSel;
  
  ${ShowParsFragment}
  
  ${Pick}
  `,
        )
        .replace(
          "void main() {",
          `
  void main() {
    ${ShowFragment}
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
  if(nvr_vBatchIdAndSel.y > 0.0) {
    diffuseColor.xyz = nvr_uHighlightColor.xyz;
  }
  `,
        )
        .replace(
          "vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;",
          `
  vec3 outgoingLight;
  if(uClampToGround && !useGroundNormals) {
    // Without lighting
    outgoingLight = diffuseColor.xyz;
  } else {
    outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
  }
  `,
        )
        .replace(
          "#include <dithering_fragment>",
          `
  #include <dithering_fragment>
  if (nvr_uPickable > 0.0 && diffuseColor.a > 0.0) {
    vec3 pickColor = nvr_batchIdToColor(nvr_vBatchIdAndSel.x);
    gl_FragColor = vec4(pickColor.xyz, 1.0);
  }
  `,
        ).source;
    };

    this.material = material;

    this._initBatchedMaterial();

    this._update(meshMaterial, mesh.active);
  }

  _update(material: PolygonMaterial, active: boolean) {
    if (!this.material.userData.prev) {
      this.material.userData.prev = {};
    }
    const prev = this.material.userData.prev;

    if (prev.color !== material.color) {
      const next = material.color ?? 0;
      this.material.color.set(next);
      prev.color = next;
    }

    const next = (material.show ?? true) && active;
    if (prev.visible !== next) {
      this.visible = next;
      prev.visible = next;
    }

    if (prev.wireframe !== material.wireframe) {
      const next = !!material.wireframe;
      this.material.wireframe = next;
      prev.wireframe = next;
    }

    const [min, max] = material.__internal__?.min_max_heights ?? [];
    if (prev.min !== min || prev.max !== max) {
      this.material.userData.uMinMaxHeight.value = [min, max];
      prev.min = min;
      prev.max = max;
    }

    if (prev.wireframe !== material.wireframe) {
      const next = !!material.use_ground_normals;
      this.material.wireframe = next;
      this.material.userData.useGroundNormals.value = next;
      prev.useGroundNormals = next;
    }

    if (
      this.material.userData.uClampToGround.value !== material.clamp_to_ground
    ) {
      this.material.userData.uClampToGround.value = material.clamp_to_ground;
    }
    this.userData.draped = material.clamp_to_ground;
  }

  _setFeatureColor(color: Color): void {
    this.material.color.set(color);
  }

  _setFeatureShow(visible: boolean): void {
    this.visible = visible;
  }

  _setFeatureExtrudedHeight(height: number): void {
    this.material.userData.uAddExtrudedHeight.value = height;
  }
}
