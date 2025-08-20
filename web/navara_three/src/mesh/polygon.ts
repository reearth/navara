import type { EventHandler, TileHandle } from "@navara/core";
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
import ShadowMapDepthFragment from "@shaders/glsl/chunks/shadowmap_depth_fragment.glsl";
import ShadowMapDepthParsFragment from "@shaders/glsl/chunks/shadowmap_depth_pars_fragment.glsl";
import ShadowMapDepthParsVertex from "@shaders/glsl/chunks/shadowmap_depth_pars_vertex.glsl";
import ShadowMapDepthVertex from "@shaders/glsl/chunks/shadowmap_depth_vertex.glsl";
import ShowFragment from "@shaders/glsl/chunks/show_fragment.glsl";
import ShowParsFragment from "@shaders/glsl/chunks/show_pars_fragment.glsl";
import ShowParsVertex from "@shaders/glsl/chunks/show_pars_vertex.glsl";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  MeshLambertMaterial,
  RGBADepthPacking,
} from "three";

import type { ViewEvents } from "..";
import type { BufferLoader } from "../event";
import type { CommonUniforms } from "../uniforms";
import { createReplacer } from "../utils";

import {
  BatchedFeatureMesh,
  type BatchedFeatureAttributes,
} from "./batchedFeature";
import type { DefaultBatchAttributeValues } from "./batchTexture";

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
    tileHandle: TileHandle | undefined,
    viewEvents: EventHandler<ViewEvents>,
  ) {
    super(new BufferGeometry<Attributes>(), new MeshLambertMaterial());
    this.initGeometry(mesh, buf);
    this.initMaterial(mesh, uniforms, tileHandle, viewEvents);
    this.initDepthMaterial();
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

  private initMaterial(
    mesh: NavaraPolygonMesh,
    uniforms: CommonUniforms,
    tileHandle: TileHandle | undefined,
    viewEvents: EventHandler<ViewEvents>,
  ) {
    const meshMaterial = mesh.material;
    const mcolor = meshMaterial.color;

    this.castShadow = !!meshMaterial.cast_shadow;
    this.receiveShadow = !!meshMaterial.receive_shadow;

    const clampToGround = meshMaterial.clamp_to_ground;
    // This mesh should be texturized if it uses clamp-to-ground.
    const isTexturized = !!tileHandle;
    const shouldClipByStencil = !isTexturized && clampToGround;
    const material = this.material;
    material.color.set(mcolor ?? 0);
    material.wireframe = !!meshMaterial.wireframe;
    material.stencilWrite = false;
    material.colorWrite = !shouldClipByStencil;
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
      value: shouldClipByStencil,
    };
    material.userData.useGroundNormals = {
      value: !isTexturized && !!meshMaterial.use_ground_normals,
    };
    material.userData.uPickable = {
      value: 0.0,
    };
    material.userData.uIsTexturized = {
      value: isTexturized,
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

  ${ShadowMapDepthParsVertex}
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
        )
        .replace(
          "#include <clipping_planes_vertex>",
          `
  #include <clipping_planes_vertex>
  ${ShadowMapDepthVertex}
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
  uniform bool uIsTexturized;
  in vec2 nvr_vBatchIdAndSel;
  
  ${ShowParsFragment}
  
  ${Pick}

  ${ShadowMapDepthParsFragment}
  `,
        )
        .replace(
          "void main() {",
          `
  void main() {
    ${ShowFragment}
    ${ShadowMapDepthFragment}
  `,
        )
        .replace(
          "#include <normal_fragment_maps>",
          `
  if(uClampToGround) {
    vec2 uv = gl_FragCoord.xy / vec2(textureSize(uGlobeNormal, 0));
    vec3 mapN = unpackVec2ToNormal(texture2D( uGlobeNormal, uv ).xy);
    // TODO: Support scaling normal. It's used to emphasis the shadow.
    // mapN.xy *= scaledNormal;
    normal = normalize( mapN );
  } else {
   #include <normal_fragment_maps>
  }
  `,
        )
        .replace(
          "#include <color_fragment>",
          `
  #include <color_fragment>

  if(nvr_vBatchIdAndSel.y > 0.0) {
    diffuseColor.xyz = nvr_uHighlightColor.xyz;
  }
  `,
        )
        .replace(
          "vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;",
          `
  vec3 outgoingLight;
  if((uClampToGround && !useGroundNormals) || uIsTexturized) {
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

    viewEvents.emit("_csmMounted", material);

    this.material = material;

    this._initBatchedMaterial();

    this._update(meshMaterial, mesh.active, isTexturized);
  }

  /**
   * Override a material that is used to generate a shadow map.
   */
  initDepthMaterial() {
    this.customDepthMaterial = this.material.clone();
    this.customDepthMaterial.needsUpdate = true;

    this.customDepthMaterial.userData = this.material.userData;

    const origin = this.material;

    this.customDepthMaterial.onBeforeCompile = (shader, renderer) => {
      origin.onBeforeCompile(shader, renderer);

      shader.defines = { ...origin.defines };
      shader.defines["USE_SHADOWMAP_DEPTH"] = 1;
      shader.defines["DEPTH_PACKING"] = RGBADepthPacking;
    };
  }

  _update(material: PolygonMaterial, active: boolean, isTexturized: boolean) {
    if (!this.material.userData.prev) {
      this.material.userData.prev = {};
    }
    const prev = this.material.userData.prev;

    if (prev.color !== material.color) {
      const next = material.color ?? 0;
      this.material.color.set(next);
      prev.color = next;
    }

    const next =
      (material.show ?? true) && (material.surface_show ?? true) && active;
    if (prev.visible !== next) {
      this.visible = next;
      prev.visible = next;
    }

    if (prev.wireframe !== material.wireframe) {
      const next = !!material.wireframe;
      this.material.wireframe = next;
      prev.wireframe = next;
    }

    if (this.castShadow !== material.cast_shadow) {
      this.castShadow = !!material.cast_shadow;
    }
    if (this.receiveShadow !== material.receive_shadow) {
      this.receiveShadow = !!material.receive_shadow;
    }

    const [min, max] = material.__internal__?.min_max_heights ?? [];
    if (prev.min !== min || prev.max !== max) {
      this.material.userData.uMinMaxHeight.value = [min, max];
      prev.min = min;
      prev.max = max;
    }

    if (this.material.userData.uIsTexturized.value !== isTexturized) {
      this.material.userData.uIsTexturized.value = isTexturized;
    }

    if (prev.use_ground_normals !== material.use_ground_normals) {
      const next = !!material.use_ground_normals;
      this.material.userData.useGroundNormals.value = !isTexturized && next;
      prev.useGroundNormals = next;
    }

    if (
      this.material.userData.uClampToGround.value !== material.clamp_to_ground
    ) {
      this.material.userData.uClampToGround.value = material.clamp_to_ground;
    }
    this.userData.draped = material.clamp_to_ground;
  }

  _getDefaultBatchAttributeValues(): DefaultBatchAttributeValues {
    return {
      color: this.material.color,
    };
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
