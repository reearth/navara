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
import HeightParsVertex from "@shaders/glsl/chunks/height_pars_vertex.glsl";
import HeightVertex from "@shaders/glsl/chunks/height_vertex.glsl";
import Pick from "@shaders/glsl/chunks/pick.glsl";
import ProjectVertexRte from "@shaders/glsl/chunks/project_vertex_rte.glsl";
import RteParsVertex from "@shaders/glsl/chunks/rte_pars_vertex.glsl";
import RteVertex from "@shaders/glsl/chunks/rte_vertex.glsl";
import ShadowMapDepthFragment from "@shaders/glsl/chunks/shadowmap_depth_fragment.glsl";
import ShadowMapDepthParsFragment from "@shaders/glsl/chunks/shadowmap_depth_pars_fragment.glsl";
import ShadowMapDepthParsVertex from "@shaders/glsl/chunks/shadowmap_depth_pars_vertex.glsl";
import ShadowMapDepthVertex from "@shaders/glsl/chunks/shadowmap_depth_vertex.glsl";
import ShowFragment from "@shaders/glsl/chunks/show_fragment.glsl";
import ShowParsFragment from "@shaders/glsl/chunks/show_pars_fragment.glsl";
import ShowParsVertex from "@shaders/glsl/chunks/show_pars_vertex.glsl";
import SpecularParsFragment from "@shaders/glsl/chunks/spucular_pars_fragment.glsl";
import WaterParsFragment from "@shaders/glsl/chunks/water_pars_fragment.glsl?raw";
import {
  AddOperation,
  BufferAttribute,
  BufferGeometry,
  Color,
  Matrix4,
  MeshLambertMaterial,
  RGBADepthPacking,
  ShaderChunk,
  Vector3,
  Sphere,
} from "three";

import { PolygonOutlineMesh, type ViewEvents } from "..";
import type { ViewContext } from "../core";
import type { BufferLoader } from "../event";
import type { CommonUniforms } from "../uniforms";
import { arraysEqual, createReplacer } from "../utils";

import {
  BatchedFeatureMesh,
  type BatchedFeatureAttributes,
} from "./batchedFeature";
import type { DefaultBatchAttributeValues } from "./batchTexture";
import { setupRTEMesh } from "./rteHelper";

type Attributes = BatchedFeatureAttributes<{
  position?: BufferAttribute; // Present when use_rte = false
  position_3d_high?: BufferAttribute; // Present when use_rte = true
  position_3d_low?: BufferAttribute; // Present when use_rte = true
  normal: BufferAttribute;
  scaleNormalAndCap: BufferAttribute;
  attrBatchId: BufferAttribute;
}>;

export class PolygonMesh extends BatchedFeatureMesh<
  BufferGeometry<Attributes>,
  MeshLambertMaterial
> {
  outline?: PolygonOutlineMesh;

  private _baseBoundingSphere?: {
    surfaceCenter: Vector3; // Center point on ellipsoid surface (without height)
    aabbRadius: number; // Horizontal extent radius from AABB
  };

  /** ViewContext for SelectiveEffect handling */
  private _viewContext: ViewContext;
  /** Layer ID for SelectiveEffect handling */
  private _layerId: string;
  private _uniforms?: CommonUniforms;

  constructor(
    buf: BufferGeometry<Attributes> = new BufferGeometry<Attributes>(),
    mat: MeshLambertMaterial = new MeshLambertMaterial(),
  ) {
    super(buf, mat);
    // Initialize with dummy values - will be set in init()
    this._viewContext = undefined as unknown as ViewContext;
    this._layerId = "";
  }

  init(
    mesh: NavaraPolygonMesh,
    buf: BufferLoader,
    uniforms: CommonUniforms,
    tileHandle: TileHandle | undefined,
    viewEvents: EventHandler<ViewEvents>,
    viewContext: ViewContext,
    layerId: string,
  ) {
    this._uniforms = uniforms;
    // TODO: Need to calculate bounding sphere by position_high and position_low.
    this.frustumCulled = false;

    // Store viewContext and layerId for SelectiveEffect handling
    this._viewContext = viewContext;
    this._layerId = layerId;

    this.initGeometry(mesh, buf);
    this.initMaterial(mesh, uniforms, tileHandle, viewEvents);
    this.initDepthMaterial();

    if (mesh.bounding_sphere) {
      const bs = mesh.bounding_sphere;

      this._baseBoundingSphere = {
        surfaceCenter: new Vector3(bs.center_x, bs.center_y, bs.center_z),
        aabbRadius: bs.radius,
      };

      this._recalculateBoundingSphere();
    }

    this.addEventListener("removedFromWorld", () => {
      this.dispose(viewEvents);
    });

    return this;
  }

  clone() {
    return new PolygonMesh(this.geometry, this.material) as this;
  }

  private initGeometry(mesh: NavaraPolygonMesh, buf: BufferLoader) {
    const g = mesh.geometry;

    // Check if RTE attributes are present
    const useRTE =
      g.position_3d_high !== undefined && g.position_3d_high.size > 0;

    const position =
      !useRTE && g.position ? buf.removeF32(g.position.data) : undefined;
    const position_3d_high =
      useRTE && g.position_3d_high
        ? buf.removeF32(g.position_3d_high.data)
        : undefined;
    const position_3d_low =
      useRTE && g.position_3d_low
        ? buf.removeF32(g.position_3d_low.data)
        : undefined;
    const normal = g.normal ? buf.removeF32(g.normal.data) : undefined;
    const scale_normal_and_cap = g.scale_normal_and_cap
      ? buf.removeF32(g.scale_normal_and_cap.data)
      : undefined;
    const indices = buf.removeU32(g.indices);
    const batchIds = g.batch_ids ? buf.removeF32(g.batch_ids.data) : undefined;
    const batchIdSize = g.batch_ids ? g.batch_ids.size : 0;
    const batchIndex = g.batch_index
      ? buf.removeU32(g.batch_index.data)
      : undefined;
    const batchIndexSize = g.batch_index ? g.batch_index.size : 0;

    if (!indices) return;
    if (!useRTE && !position) return;
    if (useRTE && (!position_3d_high || !position_3d_low)) return;

    const geometry = this.geometry;

    if (useRTE) {
      // RTE mode: set position_3d_high and position_3d_low
      if (
        position_3d_high &&
        position_3d_low &&
        g.position_3d_high &&
        g.position_3d_low
      ) {
        geometry.setAttribute(
          "position_3d_high",
          new BufferAttribute(position_3d_high, g.position_3d_high.size),
        );
        geometry.setAttribute(
          "position_3d_low",
          new BufferAttribute(position_3d_low, g.position_3d_low.size),
        );
      }
    } else {
      // Regular mode: set position
      if (position && g.position) {
        geometry.setAttribute(
          "position",
          new BufferAttribute(position, g.position.size),
        );
      }
    }

    // Store useRTE flag for later use
    this.userData.useRTE = useRTE;

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

    if (batchIds) {
      geometry.setAttribute(
        "attrBatchId",
        new BufferAttribute(batchIds, batchIdSize),
      );
    }

    if (batchIndex) {
      this._setBatchIndex(Float32Array.from(batchIndex), batchIndexSize);
    }

    geometry.setIndex(new BufferAttribute(indices, 1));

    this.userData.batchIds = batchIds;
    this.userData.batchIdSize = batchIdSize;
  }

  private enableWater() {
    if (!this.water || this.material.userData.uIsTexturized.value) {
      this.material.userData.waterNormalMap.value = null;
      return;
    }

    if (!this.visible || this.material.userData.waterNormalMap.value) {
      return;
    }

    // Use shared water texture from CommonUniforms (must be enabled via Options.waterTexture.enabled)
    if (this._uniforms?.waterTexture.value) {
      this.material.userData.waterNormalMap.value =
        this._uniforms.waterTexture.value;
      this.material.needsUpdate = true;
    }
  }

  private initMaterial(
    mesh: NavaraPolygonMesh,
    uniforms: CommonUniforms,
    tileHandle: TileHandle | undefined,
    viewEvents: EventHandler<ViewEvents>,
  ) {
    const meshMaterial = mesh.material;
    const mcolor = meshMaterial.color;

    this.castShadow = !!meshMaterial.castShadow;
    this.receiveShadow = !!meshMaterial.receiveShadow;

    const clampToGround = meshMaterial.clampToGround;
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
    material.vertexColors = false;
    this.visible = !!meshMaterial.show;
    material.transparent = !!meshMaterial.transparent;
    material.opacity = meshMaterial.opacity ?? 1.0;

    const uMinMaxHeights = meshMaterial.__internal__?.minMaxHeights;
    material.userData.uMinMaxHeight = {
      value: uMinMaxHeights,
    };
    material.userData.uAddExtrudedHeight = {
      value: 0.0,
    };
    material.userData.uAddHeight = {
      value: 0.0,
    };
    material.userData.uClampToGround = {
      value: shouldClipByStencil,
    };
    material.userData.useGroundNormals = {
      value: !isTexturized && !!meshMaterial.useGroundNormals,
    };
    material.userData.uPickable = {
      value: 0.0,
    };
    material.userData.uIsTexturized = {
      value: isTexturized,
    };
    material.userData.reflectivity = {
      value: meshMaterial.reflectivity ?? 0,
    };
    material.reflectivity = meshMaterial.reflectivity ?? 0;
    material.userData.roughness = {
      value: meshMaterial.roughness ?? 0,
    };
    material.userData.waterScaleNormal = {
      value: meshMaterial.waterScaleNormal ?? 0,
    };
    material.userData.waterSpeed = {
      value: meshMaterial.waterSpeed ?? 0,
    };
    material.userData.shininess = {
      value: meshMaterial.shininess ?? 0,
    };
    material.userData.specularStrength = {
      value: meshMaterial.specularStrength ?? 0,
    };
    material.userData.applyWaterNormal = {
      value: (meshMaterial.applyWaterNormal ?? false) ? 1.0 : 0.0,
    };
    material.userData.waterNormalMap = {
      value: null,
    };
    material.userData.specular = {
      value: meshMaterial.specular ?? false,
    };
    material.userData.ior = {
      value: meshMaterial.ior ?? 1.33333,
    };

    // Only set up RTE uniforms if using RTE
    const useRTE = this.userData.useRTE;
    if (useRTE) {
      material.userData.modelViewMatrixRTE = {
        value: new Matrix4(),
      };
      material.userData.cameraPositionHigh = {
        value: new Vector3(),
      };
      material.userData.cameraPositionLow = {
        value: new Vector3(),
      };

      const callback = setupRTEMesh(this, material.userData);
      if (callback) {
        this.onBeforeRender = callback;
        this.onBeforeShadow = callback;
      }
    }

    material.userData.defines ??= {};
    material.userData.defines.USE_ROUGHNESS = 1;
    this.water = !!meshMaterial.water;

    this.enableWater();

    material.customProgramCacheKey = () =>
      material.onBeforeCompile.toString() +
      JSON.stringify(material.userData.defines);

    material.onBeforeCompile = (shader) => {
      shader.defines ??= {};
      Object.assign(shader.defines, material.userData.defines);
      if (!isTexturized && this.water) {
        material.envMap = uniforms.tSkyEnvMap.value ?? null;
        material.combine = AddOperation;
      } else {
        material.envMap = null;
      }
      shader.uniforms.uGlobeNormal = uniforms.tGlobeNormal;
      shader.uniforms.nvr_uPickable = material.userData.uPickable;
      shader.uniforms.useGroundNormals = material.userData.useGroundNormals;
      shader.uniforms.reflectivity = material.userData.reflectivity;
      shader.uniforms.roughness = material.userData.roughness;
      shader.uniforms.uWaterNormalMap = material.userData.waterNormalMap;
      shader.uniforms.uWaterScaleNormal = material.userData.waterScaleNormal;
      shader.uniforms.uWaterSpeed = material.userData.waterSpeed;
      shader.uniforms.uShininess = material.userData.shininess;
      shader.uniforms.uSpecularStrength = material.userData.specularStrength;
      shader.uniforms.uApplyWaterNormal = material.userData.applyWaterNormal;
      shader.uniforms.uSpecular = material.userData.specular;
      shader.uniforms.uIor = material.userData.ior;
      shader.uniforms.uTime = uniforms.time;

      // Only add RTE uniforms if using RTE
      if (useRTE) {
        shader.uniforms.u_cameraPositionHigh =
          material.userData.cameraPositionHigh;
        shader.uniforms.u_cameraPositionLow =
          material.userData.cameraPositionLow;
        shader.uniforms.modelViewMatrixRTE =
          material.userData.modelViewMatrixRTE;
      }

      if (material.userData.uMinMaxHeight.value) {
        shader.uniforms.uMinMaxHeight = material.userData.uMinMaxHeight;
      }
      shader.uniforms.uAddExtrudedHeight = material.userData.uAddExtrudedHeight;
      shader.uniforms.uAddHeight = material.userData.uAddHeight;
      if (material.userData.uClampToGround.value != null) {
        shader.uniforms.uClampToGround = material.userData.uClampToGround;
      }

      if (material.userData.batchDataTexture) {
        shader.uniforms.batchDataTexture = material.userData.batchDataTexture;
      }

      shader.uniforms.uIsTexturized = material.userData.uIsTexturized;

      // Build vertex shader with conditional RTE support
      // RTE mode: use RTE shaders
      shader.vertexShader = createReplacer(shader.vertexShader)
        .replace(
          "#include <common>",
          `
  #include <common>
  in float attrBatchId;
  in vec4 scaleNormalAndCap;

  uniform vec2 uMinMaxHeight;
  out float nvr_vBatchId;

  ${useRTE ? RteParsVertex : ""}
  ${ShowParsVertex}
  ${ExtrudedHeightParsVertex}
  ${HeightParsVertex}
  ${BatchTextureParsVertex}

  ${BranchFreeTernary}

  ${ShadowMapDepthParsVertex}

  varying vec3 vPosition;
  `,
        )
        .replace(
          "#include <begin_vertex>",
          `
  ${useRTE ? RteVertex : "#include <begin_vertex>"}

  ${ExtrudedHeightVertex}
  ${HeightVertex}
  ${BatchTextureVertex}

  transformed.xyz += scaleNormalAndCap.xyz * nvr_branchFreeTernary(
    scaleNormalAndCap.w == 0.0,
    uMinMaxHeight.x + addHeight,
    uMinMaxHeight.y + addExtrudedHeight
  );

  // Use the original GlobalBatchId for picking, not the batch_index
  nvr_vBatchId = attrBatchId;
  `,
        )
        .replace(
          "#include <clipping_planes_vertex>",
          `
  #include <clipping_planes_vertex>
  ${ShadowMapDepthVertex}
  `,
        )
        .replaceWithCondition(
          "#include <project_vertex>",
          ProjectVertexRte,
          useRTE,
        )
        .replaceWithCondition(
          "#include <envmap_vertex>",
          `
  #include <envmap_vertex>

  vPosition = absTransformed.xyz;
  vViewPosition = -absMvPosition.xyz;
  `,
          useRTE,
        )
        .replaceWithCondition(
          "#include <worldpos_vertex>",
          createReplacer(ShaderChunk.worldpos_vertex).replace(
            "vec4 worldPosition = vec4( transformed, 1.0 );",
            "vec4 worldPosition = vec4( absTransformed, 1.0 );",
          ).source,
          useRTE,
        )
        .replaceWithCondition(
          "#include <envmap_vertex>",
          `
  #include <envmap_vertex>

  vPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
  `,
          !useRTE,
        ).source;

      shader.fragmentShader = createReplacer(shader.fragmentShader)
        .replace(
          "uniform vec3 diffuse;",
          `
  uniform vec3 diffuse;
  uniform bool uClampToGround;
  uniform bool useGroundNormals;
  uniform sampler2D uGlobeNormal;
  uniform float nvr_uPickable;
  uniform bool uIsTexturized;
  uniform sampler2D uWaterNormalMap;
  uniform float uWaterScaleNormal;
  uniform float uWaterSpeed;
  uniform float uShininess;
  uniform float uSpecularStrength;
  uniform float uApplyWaterNormal;
  uniform bool uSpecular;
  uniform float uIor;
  uniform float uTime;

  in float nvr_vBatchId;
  
  ${ShowParsFragment}
  
  ${Pick}

  ${ShadowMapDepthParsFragment}
  `,
        )
        .replace(
          "#include <lights_lambert_pars_fragment>",
          `
        #include <lights_lambert_pars_fragment>

        ${WaterParsFragment}
        ${SpecularParsFragment}
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
  vec3 origNormal = vec3(normal);
  vec3 specular;
  
  if(uClampToGround) {
    vec2 uv = gl_FragCoord.xy / vec2(textureSize(uGlobeNormal, 0));
    vec3 mapN = unpackVec2ToNormal(texture2D( uGlobeNormal, uv ).xy);
    // TODO: Support scaling normal. It's used to emphasis the shadow.
    // mapN.xy *= scaledNormal;
    normal = normalize( mapN );
  } else {
   #include <normal_fragment_maps>
  }

  #ifdef WATER
  if(!uIsTexturized) {
    specular = computeWaterSpecular(
      uWaterNormalMap,
      (vPosition.xy + vPosition.zy + vPosition.xz) / 3.0 * uWaterScaleNormal,
      uTime * uWaterSpeed,
      vViewPosition,
      normalMatrix,
      origNormal,
      uShininess,
      uSpecularStrength,
      diffuseColor.rgb,
      normal
    );
  }
  #else
  if(uSpecular && !uIsTexturized) {
    specular = computeSpecular(
      vViewPosition,
      origNormal,
      uShininess,
      uSpecularStrength,
      uIor
    );
  }
  #endif

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
    if(!uIsTexturized) {
      outgoingLight += specular;
    }
  }
  `,
        )
        .replace(
          "#include <dithering_fragment>",
          `
  #include <dithering_fragment>
  if (nvr_uPickable > 0.0 && diffuseColor.a > 0.0) {
    vec3 pickColor = nvr_batchIdToColor(nvr_vBatchId);
    gl_FragColor = vec4(pickColor.xyz, 1.0);
  }
  `,
        )
        .replace(
          "outputBuffer1 = vec4(packNormalToVec2(normal), reflectivity, roughnessFactor);",
          `
    vec3 finalNormal = mix(origNormal, normalize(origNormal * 0.7 + normal), uApplyWaterNormal);
    outputBuffer1 = vec4(packNormalToVec2(finalNormal), reflectivity, roughnessFactor);
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

      shader.defines ??= {};
      Object.assign(shader.defines, origin.userData.defines || {});
      shader.defines["USE_SHADOWMAP_DEPTH"] = 1;
      shader.defines["DEPTH_PACKING"] = RGBADepthPacking;
    };
  }

  _update(material: PolygonMaterial, active: boolean, isTexturized: boolean) {
    if (!this.material.userData.prev) {
      this.material.userData.prev = {};
    }
    const prev = this.material.userData.prev;

    // Only update material.color if batchTexture color is not being used
    if (prev.color !== material.color) {
      const next = material.color ?? 0;
      // If batchTexture color is not enabled, update material.color directly
      if (!this.material.userData._batchColorTouched) {
        this.material.color.set(next);
      }
      prev.color = next;
    }

    const next =
      (material.show ?? true) && (material.surfaceShow ?? true) && active;
    if (prev.visible !== next) {
      this.visible = next;
      prev.visible = next;
      this.enableWater();
    }

    if (prev.wireframe !== material.wireframe) {
      const next = !!material.wireframe;
      this.material.wireframe = next;
      prev.wireframe = next;
    }

    if (prev.transparent !== material.transparent) {
      const next = !!material.transparent;
      this.material.transparent = next;
      prev.transparent = next;
    }

    if (prev.opacity !== material.opacity) {
      const next = material.opacity ?? 1.0;
      this.material.opacity = next;
      prev.opacity = next;
    }

    if (this.castShadow !== material.castShadow) {
      this.castShadow = !!material.castShadow;
    }
    if (this.receiveShadow !== material.receiveShadow) {
      this.receiveShadow = !!material.receiveShadow;
    }

    if (prev.reflectivity !== material.reflectivity) {
      const next = material.reflectivity ?? 0;
      this.material.userData.reflectivity.value = next;
      this.material.reflectivity = next;
      prev.reflectivity = next;
    }

    const [min, max] = material.__internal__?.minMaxHeights ?? [];
    if (prev.min !== min || prev.max !== max) {
      this.material.userData.uMinMaxHeight.value = [min, max];
      prev.min = min;
      prev.max = max;

      this._recalculateBoundingSphere();
    }

    if (this.material.userData.uIsTexturized.value !== isTexturized) {
      this.material.userData.uIsTexturized.value = isTexturized;
    }

    if (prev.useGroundNormals !== material.useGroundNormals) {
      const next = !!material.useGroundNormals;
      this.material.userData.useGroundNormals.value = !isTexturized && next;
      prev.useGroundNormals = next;
    }

    if (prev.roughness !== material.roughness) {
      const next = material.roughness ?? 0;
      this.material.userData.roughness.value = next;
      prev.roughness = next;
    }

    if (
      this.material.userData.uClampToGround.value !== material.clampToGround
    ) {
      this.material.userData.uClampToGround.value = material.clampToGround;

      this._recalculateBoundingSphere();
    }
    this.userData.draped = material.clampToGround;

    if (prev.water !== material.water) {
      const next = !!material.water;
      this.water = next;
      prev.water = next;
      this.enableWater();
    }

    if (prev.waterScaleNormal !== material.waterScaleNormal) {
      const next = material.waterScaleNormal ?? 0;
      this.material.userData.waterScaleNormal.value = next;
      prev.waterScaleNormal = next;
    }

    if (prev.waterSpeed !== material.waterSpeed) {
      const next = material.waterSpeed ?? 0;
      this.material.userData.waterSpeed.value = next;
      prev.waterSpeed = next;
    }

    if (prev.shininess !== material.shininess) {
      const next = material.shininess ?? 0;
      this.material.userData.shininess.value = next;
      prev.shininess = next;
    }

    if (prev.specularStrength !== material.specularStrength) {
      const next = material.specularStrength ?? 0;
      this.material.userData.specularStrength.value = next;
      prev.specularStrength = next;
    }

    if (prev.applyWaterNormal !== material.applyWaterNormal) {
      const next = material.applyWaterNormal ?? 0;
      this.material.userData.applyWaterNormal.value = next;
      prev.applyWaterNormal = next;
    }

    if (prev.specular !== material.specular) {
      const next = material.specular ?? false;
      this.material.userData.specular.value = next;
      prev.specular = next;
    }

    if (prev.ior !== material.ior) {
      const next = material.ior ?? 1.33333;
      this.material.userData.ior.value = next;
      prev.ior = next;
    }

    // SelectiveEffect: effectIds handling
    if (!arraysEqual(prev.effectIds, material.effectIds)) {
      this._viewContext.selectiveEffectRegistry?.updateLinksForObject(
        this,
        material.effectIds ?? [],
        prev.effectIds ?? [],
        this._layerId,
      );
      prev.effectIds = material.effectIds ? [...material.effectIds] : [];
    }

    // SelectiveEffect: emissiveColor handling
    if (prev.emissiveColor !== material.emissiveColor) {
      this.material.emissive.set(material.emissiveColor ?? 0);
      prev.emissiveColor = material.emissiveColor;
    }

    // SelectiveEffect: emissiveIntensity handling
    if (prev.emissiveIntensity !== material.emissiveIntensity) {
      this.material.emissiveIntensity = material.emissiveIntensity ?? 0;
      prev.emissiveIntensity = material.emissiveIntensity;
    }
  }

  private _recalculateBoundingSphere() {
    const base = this._baseBoundingSphere;
    if (!base) {
      return;
    }

    if (this.material.userData.uClampToGround.value) {
      this.geometry.boundingSphere = new Sphere(
        base.surfaceCenter,
        base.aabbRadius,
      );
      return;
    }

    const addHeight = this.material.userData.uAddHeight.value ?? 0;
    const addExtrudedHeight =
      this.material.userData.uAddExtrudedHeight.value ?? 0;

    const baseMinMaxHeight = this.material.userData.uMinMaxHeight.value as
      | [number, number]
      | undefined;
    if (!baseMinMaxHeight) return;

    const minHeight = baseMinMaxHeight[0] + addHeight;
    const maxHeight = baseMinMaxHeight[1] + addHeight + addExtrudedHeight;

    const heightOffset = (maxHeight - minHeight) / 2.0;
    const centerHeight = (maxHeight + minHeight) / 2.0;

    // Get surface normal from surface center
    const surfaceNormal = base.surfaceCenter.clone().normalize();

    // Calculate new center by elevating along surface normal
    const center = base.surfaceCenter
      .clone()
      .add(surfaceNormal.multiplyScalar(centerHeight));

    // Calculate new radius using Pythagorean theorem
    const radius = Math.sqrt(
      base.aabbRadius * base.aabbRadius + heightOffset * heightOffset,
    );

    // Update geometry bounding sphere
    this.geometry.boundingSphere = new Sphere(center, radius);
  }

  _getDefaultBatchAttributeValues(): DefaultBatchAttributeValues {
    return {
      color: this.material.color,
    };
  }

  _setFeatureColor(color: Color): void {
    // If batchTexture is being used, update via batchTexture
    if (this.material.userData._batchColorTouched) {
      super._setFeatureColor(color);
    } else {
      // Otherwise, update material.color directly
      this.material.color.set(color);
    }
    // TODO: Support outline color
  }

  _setFeatureShow(visible: boolean): void {
    this.visible = visible;
    this.outline?._setFeatureShow(this.outline.visible && visible);
    this.enableWater();
  }

  _setFeatureExtrudedHeight(height: number): void {
    this.material.userData.uAddExtrudedHeight.value = height;
    this.outline?._setFeatureExtrudedHeight(height);
    this._recalculateBoundingSphere();
  }

  _setFeatureHeight(height: number): void {
    this.material.userData.uAddHeight.value = height;
    this.outline?._setFeatureHeight(height);
    this._recalculateBoundingSphere();
  }

  get water() {
    return !!this.material.userData.defines?.WATER;
  }
  set water(v: boolean) {
    this.material.userData.defines ??= {};
    if (v) {
      this.material.userData.defines.WATER = 1;
      this.material.userData.defines.USE_UV = 1;
    } else {
      delete this.material.userData.defines.WATER;
    }
    this.material.needsUpdate = true;
  }

  dispose(viewEvents: EventHandler<ViewEvents>) {
    viewEvents.emit("_csmUnmounted", this.material);
  }
}
