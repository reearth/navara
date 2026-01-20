import { Unimplemented } from "@navara/core";
import type {
  TextMaterial as NavaraTextMaterial,
  Transform,
} from "@navara/engine";
import BatchDefinitioin from "@shaders/glsl/chunks/batch_definition.glsl";
import BillboardMatrix from "@shaders/glsl/chunks/billboardMat.glsl";
import HeightParsVertex from "@shaders/glsl/chunks/height_pars_vertex.glsl";
import HorizonCullingParsVertex from "@shaders/glsl/chunks/horizon_culling_pars_vertex.glsl";
import HorizonCullingVertex from "@shaders/glsl/chunks/horizon_culling_vertex.glsl";
import Pick from "@shaders/glsl/chunks/pick.glsl";
import PixelToWorld from "@shaders/glsl/chunks/pixelToWorld.glsl";
import RteUniformParsVertex from "@shaders/glsl/chunks/rte_uniform_pars_vertex.glsl";
import SdRoundedBox from "@shaders/glsl/chunks/sdRoundedBox.glsl";
import SpriteHeightParsVertex from "@shaders/glsl/chunks/sprite_height_pars_vertex.glsl";
import CalcLogDepthParsVertex from "@shaders/glsl/chunks/calc_log_depth_pars_vertex.glsl";
import RtcSpriteVertex from "@shaders/glsl/chunks/rtc_sprite_vertex.glsl";
import {
  Color,
  Group,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector2,
  Vector3,
  LessDepth,
} from "three";
import { Text } from "troika-three-text";

import type { CommonUniforms } from "../uniforms";
import { createReplacer } from "../utils";

import type { FeatureMesh } from "./featureMesh";
import type { PickableMesh } from "./pickableMesh";
import {
  setupRTEBeforeRender,
  setRTEPosition,
  setRTCPosition,
} from "./rtcRteHelper";

export class TextMesh extends Group implements FeatureMesh, PickableMesh {
  text: Text;
  background?: Mesh<PlaneGeometry, MeshBasicMaterial>;

  constructor(
    meshMaterial: NavaraTextMaterial,
    uniforms: CommonUniforms,
    batchId: number,
    useRTE = false,
  ) {
    super();

    this.text = new Text();

    this.userData.rtcPos = {
      value: new Vector3(),
    };
    this.userData.rtePosHigh = {
      value: new Vector3(),
    };
    this.userData.rtePosLow = {
      value: new Vector3(),
    };
    this.userData.useRTE = useRTE;

    this.userData.scaleByDistance = {
      value: meshMaterial.scaleByDistance ? 1.0 : 0.0,
    };
    this.userData.fontSizePx = {
      value: meshMaterial.size ?? 1.0,
    };
    this.userData.bgColor = {
      value: meshMaterial.backgroundColor
        ? new Color(meshMaterial.backgroundColor)
        : undefined,
    };
    this.userData.borderColor = {
      value: meshMaterial.borderColor
        ? new Color(meshMaterial.borderColor)
        : undefined,
    };
    this.userData.borderWidth = {
      value: meshMaterial.borderWidth ?? 0.0,
    };
    this.userData.outlineWidthPx = {
      value: meshMaterial.outlineWidth ?? 0.0,
    };
    this.userData.outlineBlurPx = {
      value: meshMaterial.outlineBlur ?? 0.0,
    };
    this.userData.outlineOffsetPx = {
      x: meshMaterial?.outlineOffset?.x ?? 0.0,
      y: meshMaterial?.outlineOffset?.y ?? 0.0,
    };
    this.userData.cornerRadius = {
      value: meshMaterial.cornerRadius ?? 0.0,
    };
    this.userData.bgSize = {
      value: new Vector2(1.0, 1.0),
    };
    this.userData.uPickable = {
      value: 0.0,
    };
    this.userData.center = {
      x: meshMaterial?.center?.x ?? 0.5,
      y: meshMaterial?.center?.y ?? 0,
    };
    this.userData.fontSizeWorld = {
      value: 0.0,
    };
    this.userData.padding = {
      x: meshMaterial?.padding?.x ?? 0.5,
      y: meshMaterial?.padding?.y ?? 0,
    };

    this.userData.fov = uniforms?.fov;
    this.userData.screenHeightPx = uniforms?.screenHeightPx;
    this.userData.batchId = batchId;
    this.userData.addHeight = {
      value: 0.0,
    };

    this.userData.uOffsetDepth = {
      value: meshMaterial.offsetDepth ?? true,
    };

    // Set up RTE uniforms if using RTE (matching point.ts)
    if (useRTE) {
      this.userData.modelViewMatrixRTE = {
        value: new Matrix4(),
      };
      this.userData.cameraPositionHigh = {
        value: new Vector3(),
      };
      this.userData.cameraPositionLow = {
        value: new Vector3(),
      };
    }

    this.initText(meshMaterial);
  }

  private initText(meshMaterial: NavaraTextMaterial) {
    const txt = this.text;
    txt.fontSize = 1;

    // Note: outlineWidth is set to 0 initially to avoid sampling priority issues
    txt.outlineColor = meshMaterial.outlineColor
      ? new Color(meshMaterial.outlineColor).getHex()
      : 0x000000;
    txt.outlineBlur = 0.0;
    txt.outlineOffsetX = 0.0;
    txt.outlineOffsetY = 0.0;
    txt.outlineOpacity = meshMaterial.outlineOpacity ?? 1.0;
    txt.outlineWidth = 0.0; // Always start with 0 to prevent sampling size optimization issues

    const useRTE = this.userData.useRTE || false;

    txt.material.depthFunc = LessDepth;
    (txt.material as Material).onBeforeCompile = (shader) => {
      shader.uniforms.nvr_uScaleByDistance = this.userData.scaleByDistance;
      shader.uniforms.nvr_uFontSizePx = this.userData.fontSizePx;
      shader.uniforms.nvr_uFontSizeWorld = this.userData.fontSizeWorld;
      shader.uniforms.nvr_uBatchId = { value: this.userData.batchId };
      shader.uniforms.nvr_uPickable = this.userData.uPickable;
      shader.uniforms.nvr_uFov = this.userData.fov;
      shader.uniforms.nvr_uScreenHeightPx = this.userData.screenHeightPx;
      shader.uniforms.uAddHeight = this.userData.addHeight;
      shader.uniforms.uOffsetDepth = this.userData.uOffsetDepth;

      // RTC/RTE: Pass position uniforms
      shader.uniforms.rtcPos = this.userData.rtcPos;
      shader.uniforms.rtePosHigh = this.userData.rtePosHigh;
      shader.uniforms.rtePosLow = this.userData.rtePosLow;
      shader.uniforms.useRTE = { value: useRTE };

      if (useRTE) {
        shader.uniforms.u_cameraPositionHigh = this.userData.cameraPositionHigh;
        shader.uniforms.u_cameraPositionLow = this.userData.cameraPositionLow;
        shader.uniforms.modelViewMatrixRTE = this.userData.modelViewMatrixRTE;
      } else {
        // Set default values for non-RTE mode
        shader.uniforms.u_cameraPositionHigh = { value: new Vector3() };
        shader.uniforms.u_cameraPositionLow = { value: new Vector3() };
        shader.uniforms.modelViewMatrixRTE = { value: new Matrix4() };
      }

      shader.vertexShader = createReplacer(shader.vertexShader)
        .replace(
          `uniform vec3 diffuse;`,
          `
            uniform vec3 diffuse;
            uniform float nvr_uScaleByDistance;
            uniform float nvr_uFontSizePx;
            uniform float nvr_uFontSizeWorld;
            uniform float nvr_uFov;
            uniform float nvr_uScreenHeightPx;
            uniform vec3 rtcPos;
            uniform bool useRTE;
            ${RteUniformParsVertex}
            ${HeightParsVertex}
            ${BillboardMatrix}
            ${PixelToWorld}
            ${HorizonCullingParsVertex}
            ${SpriteHeightParsVertex}
            ${CalcLogDepthParsVertex}
            `,
        )
        .replace(
          `gl_Position = projectionMatrix * mvPosition;`,
          `
            float scaleFactor = nvr_uFontSizePx;
            vec4 anchorMv;

            if (useRTE) {
              // RTE mode: Decode anchor position without overwriting 'transformed'
              // Keep original 'transformed' for text vertices
              vec3 absTransformed = rtePosHigh + rtePosLow;
              vec3 anchorCameraRelative = (rtePosHigh - u_cameraPositionHigh) + (rtePosLow - u_cameraPositionLow);

              // Calculate scale using world position approximation
              if (nvr_uScaleByDistance > 0.0) {
                float worldSize = nvr_pxToWorld(nvr_uFontSizePx, nvr_uFov, nvr_uScreenHeightPx, absTransformed, cameraPosition);
                scaleFactor = worldSize / nvr_uFontSizeWorld;
              }

              ${HorizonCullingVertex}

              // Convert high-precision camera-relative anchor position to view space
              anchorMv = modelViewMatrixRTE * vec4(anchorCameraRelative, 1.0);

              // Apply height offset
              anchorMv.xyz += mvr_getMvHeightOffset(absTransformed, uAddHeight).xyz;

              // Create billboard matrix for screen-aligned rendering
              mat4 billboardMatrix = nvr_getBillboardMat(scaleFactor);

              // Apply billboard transform to text vertices
              vec4 delta = billboardMatrix * vec4(transformed, 0.0);
              vec4 newMvPosition = anchorMv + delta;
              gl_Position = projectionMatrix * newMvPosition;

              // Calculate correct fragDepth for logarithmic depth buffer
              vFragDepthManual = nvr_calcLogDepth(vec4(absTransformed, 1.0));
            } else {
              ${RtcSpriteVertex}

              if (nvr_uScaleByDistance > 0.0) {
                float worldSize = nvr_pxToWorld(nvr_uFontSizePx, nvr_uFov, nvr_uScreenHeightPx, absTransformed, cameraPosition);
                scaleFactor = worldSize / nvr_uFontSizeWorld;
              }
              mat4 billboardMatrix = nvr_getBillboardMat(scaleFactor);

              // Horizon culling
              ${HorizonCullingVertex}

              // Apply height offset
              anchorMv = posMv + mvr_getMvHeightOffset(absTransformed, uAddHeight);

              // Apply billboard transform to text vertices
              vec4 delta = billboardMatrix * vec4(transformed, 0.0);
              vec4 newMvPosition = anchorMv + delta;
              gl_Position = projectionMatrix * newMvPosition;

              // Calculate correct fragDepth for logarithmic depth buffer
              vFragDepthManual = nvr_calcLogDepth(vec4(absTransformed, 1.0));
            }
            `,
        ).source;

      shader.fragmentShader = createReplacer(shader.fragmentShader)
        .replace(
          `void main() {`,
          `
      ${BatchDefinitioin}
      ${Pick}
        flat in int vHorizonCulled;
        in float vFragDepthManual;
        uniform bool uOffsetDepth;

        void main() {
          if (vHorizonCulled == 1) discard;
            `,
        )
        .replace(
          `//!END_POST_CHUNK`,
          `//!END_POST_CHUNK
            if (nvr_uPickable > 0.0) {
              vec3 pickColor = nvr_batchIdToColor(nvr_uBatchId);
              gl_FragColor = vec4(pickColor.xyz, 1.0);
            }

            // Manual logarithmic depth calculation for RTE/RTC mode
            #if defined( USE_LOGDEPTHBUF )
              float depthMultiplier = uOffsetDepth ? 0.8 : 1.0;
              gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepthManual * depthMultiplier ) * logDepthBufFC * 0.5;
            #endif
            `,
        ).source;
    };

    this.text = txt;
    this.add(txt);

    if (useRTE) {
      // TODO: calculate bounding sphere and aabb
      txt.frustumCulled = false;
    }

    return this.text;
  }

  _createBackground() {
    if (this.background) return this.background;

    const backgroundMaterial = new MeshBasicMaterial();
    const background = new Mesh(new PlaneGeometry(), backgroundMaterial);
    const useRTE = this.userData.useRTE || false;

    background.material.depthFunc = LessDepth;
    background.material.onBeforeCompile = (shader) => {
      shader.uniforms.nvr_uScaleByDistance = this.userData.scaleByDistance;
      shader.uniforms.nvr_uFontSizePx = this.userData.fontSizePx;
      shader.uniforms.nvr_uFontSizeWorld = this.userData.fontSizeWorld;
      shader.uniforms.nvr_uCornerRadius = this.userData.cornerRadius;
      shader.uniforms.nvr_uFillColor = this.userData.bgColor;
      shader.uniforms.nvr_uBorderColor = this.userData.borderColor;
      shader.uniforms.nvr_uBorderWidth = this.userData.borderWidth;
      shader.uniforms.nvr_uGeomSize = this.userData.bgSize;
      shader.uniforms.nvr_uBatchId = { value: this.userData.batchId };
      shader.uniforms.nvr_uPickable = this.userData.uPickable;
      shader.uniforms.nvr_uFov = this.userData.fov;
      shader.uniforms.nvr_uScreenHeightPx = this.userData.screenHeightPx;
      shader.uniforms.uAddHeight = this.userData.addHeight;
      shader.uniforms.uOffsetDepth = this.userData.uOffsetDepth;

      // RTC/RTE: Pass position uniforms
      shader.uniforms.rtcPos = this.userData.rtcPos;
      shader.uniforms.rtePosHigh = this.userData.rtePosHigh;
      shader.uniforms.rtePosLow = this.userData.rtePosLow;
      shader.uniforms.useRTE = { value: useRTE };

      // Always set RTE uniforms (matching point.ts)
      if (useRTE) {
        shader.uniforms.u_cameraPositionHigh = this.userData.cameraPositionHigh;
        shader.uniforms.u_cameraPositionLow = this.userData.cameraPositionLow;
        shader.uniforms.modelViewMatrixRTE = this.userData.modelViewMatrixRTE;
      } else {
        shader.uniforms.u_cameraPositionHigh = { value: new Vector3() };
        shader.uniforms.u_cameraPositionLow = { value: new Vector3() };
        shader.uniforms.modelViewMatrixRTE = { value: new Matrix4() };
      }

      shader.vertexShader = createReplacer(shader.vertexShader)
        .replace(
          `void main() {`,
          `
        uniform float nvr_uScaleByDistance;
        uniform float nvr_uFontSizePx;
        uniform float nvr_uFontSizeWorld;
        uniform float nvr_uFov;
        uniform float nvr_uScreenHeightPx;
        uniform vec3 rtcPos;
        uniform bool useRTE;
        ${RteUniformParsVertex}
        out vec2 vUv;
        ${HeightParsVertex}
        ${BillboardMatrix}
        ${PixelToWorld}
        ${HorizonCullingParsVertex}
        ${SpriteHeightParsVertex}
        ${CalcLogDepthParsVertex}
        void main() {
          vUv = uv;
        `,
        )
        .replace(
          `#include <fog_vertex>`,
          `
        #include <fog_vertex>

        // For PlaneGeometry with MeshBasicMaterial, transformed is defined in #include <begin_vertex>
        float scaleFactor = nvr_uFontSizePx;
        vec4 anchorMv;

        if (useRTE) {
          vec3 absTransformed = rtePosHigh + rtePosLow;
          vec3 highDiff = rtePosHigh - u_cameraPositionHigh;
          vec3 lowDiff = rtePosLow - u_cameraPositionLow;
          vec3 anchorCameraRelative = highDiff + lowDiff;

          // Calculate scale using world position approximation
          if (nvr_uScaleByDistance > 0.0) {
            float worldSize = nvr_pxToWorld(nvr_uFontSizePx, nvr_uFov, nvr_uScreenHeightPx, absTransformed, cameraPosition);
            scaleFactor = worldSize / nvr_uFontSizeWorld;
          }

          ${HorizonCullingVertex}

          // Convert high-precision camera-relative anchor position to view space
          anchorMv = modelViewMatrixRTE * vec4(anchorCameraRelative, 1.0);

          // Apply height offset
          anchorMv.xyz += mvr_getMvHeightOffset(absTransformed, uAddHeight).xyz;

          // Create billboard matrix for screen-aligned rendering
          mat4 billboardMatrix = nvr_getBillboardMat(scaleFactor);

          vec4 delta = billboardMatrix * vec4(transformed, 0.0);
          vec4 newMvPosition = anchorMv + delta;

          gl_Position = projectionMatrix * newMvPosition;

          // Calculate correct fragDepth for logarithmic depth buffer
          vFragDepthManual = nvr_calcLogDepth(vec4(absTransformed, 1.0));
        } else {
          ${RtcSpriteVertex}

          if (nvr_uScaleByDistance > 0.0) {
            float worldSize = nvr_pxToWorld(nvr_uFontSizePx, nvr_uFov, nvr_uScreenHeightPx, absTransformed, cameraPosition);
            scaleFactor = worldSize / nvr_uFontSizeWorld;
          }

          mat4 billboardMatrix = nvr_getBillboardMat(scaleFactor);

          // Horizon culling
          ${HorizonCullingVertex}

          // Apply height offset
          anchorMv = posMv + mvr_getMvHeightOffset(absTransformed, uAddHeight);

          vec4 delta = billboardMatrix * vec4(transformed, 0.0);
          vec4 newMvPosition = anchorMv + delta;

          gl_Position = projectionMatrix * newMvPosition;

          // Calculate correct fragDepth for logarithmic depth buffer
          vFragDepthManual = nvr_calcLogDepth(vec4(absTransformed, 1.0));
        }
        `,
        ).source;

      shader.fragmentShader = createReplacer(shader.fragmentShader)
        .replace(
          `uniform vec3 diffuse;`,
          `
        uniform vec3 diffuse;
        uniform float nvr_uCornerRadius;
        uniform vec3 nvr_uFillColor;
        uniform vec3 nvr_uBorderColor;
        uniform float nvr_uBorderWidth;
        uniform vec2 nvr_uGeomSize;
        ${BatchDefinitioin}
        in vec2 vUv;
        ${Pick}
        ${SdRoundedBox}
        in float vFragDepthManual;
        uniform bool uOffsetDepth;
        `,
        )
        .replace(
          `#include <dithering_fragment>`,
          `
        #include <dithering_fragment>
          if (nvr_uPickable > 0.0) {
            vec3 pickColor = nvr_batchIdToColor(nvr_uBatchId);
            gl_FragColor = vec4(pickColor.xyz, 1.0);
            return;
          }
  
          // Calculate UV coordinates relative to center and scaled by geometry size
          vec2 uv = (vUv - 0.5) * nvr_uGeomSize;
          float border = nvr_uBorderWidth * nvr_uGeomSize.y;

          // Calculate outer corner radius (clamped to half the smallest dimension)
          float outRadius = min(nvr_uGeomSize.y * nvr_uCornerRadius, min(nvr_uGeomSize.x, nvr_uGeomSize.y) * 0.5);
          
          // Calculate inner radius (ensuring it doesn't go negative)
          float inRadius = max(outRadius - border, 0.0);

          // Calculate distance to outer rounded box
          float d = nvr_sdRoundedBox(uv, nvr_uGeomSize * 0.5, outRadius);
          if (d > 0.0) {
              // If outside the outer shape, discard the fragment
              discard;
          }
          else{
              // Otherwise, set color to border color
              gl_FragColor = vec4(nvr_uBorderColor, 1.0);
          }

          // Calculate distance to inner rounded box (border inset)
          d = nvr_sdRoundedBox(uv, nvr_uGeomSize * 0.5 - vec2(border), inRadius);
          if (d <= 0.0) {
              // If inside the inner shape, overwrite with fill color
              gl_FragColor = vec4(nvr_uFillColor, 1.0);
          }

          // Manual logarithmic depth calculation for RTE/RTC mode
          // Background should be behind text, use relative offset for consistent separation at all distances
          #if defined( USE_LOGDEPTHBUF )
            float backgroundOffset = 1.001; // 0.1% further than text
            float depthMultiplier = uOffsetDepth ? (backgroundOffset * 0.8) : backgroundOffset;
            gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepthManual * depthMultiplier ) * logDepthBufFC * 0.5;
          #endif
        `,
        )
        .replace(
          "void main() {",
          `
        flat in int vHorizonCulled;

        void main() {
          if (vHorizonCulled == 1) discard;`,
        ).source;
    };

    if (useRTE) {
      // Text uses identity matrix for camera position (world space)
      const identityMatrix = new Matrix4();
      const callback = setupRTEBeforeRender(
        this,
        this.userData,
        undefined,
        identityMatrix,
      );
      if (callback) {
        background.onBeforeRender = callback;
      }
    }

    this.background = background;
    this.add(background);

    if (useRTE) {
      // TODO: calculate bounding sphere and aabb
      background.frustumCulled = false;
    }

    return this.background;
  }

  setPosition(
    useRTE: boolean,
    position: Float32Array<ArrayBufferLike> | null | undefined,
    positionHigh: Float32Array<ArrayBufferLike> | null | undefined,
    positionLow: Float32Array<ArrayBufferLike> | null | undefined,
    posIdx: number,
    transform: Transform,
  ): void {
    if (useRTE) {
      setRTEPosition(this, positionHigh, positionLow, posIdx, transform);
      this.scale.set(1, 1, 1); // instead of this, set text size by fontSizePx uniform
    } else {
      setRTCPosition(this, position, posIdx, transform);
    }
  }

  _updateTextByMaterial(
    material: NavaraTextMaterial,
    active: boolean,
    needRender?: () => void,
  ) {
    if (!this.userData.prev) {
      this.userData.prev = {};
    }
    const prev = this.userData.prev;

    const txt = this.text;

    let bNeedUpdateBg = false;
    let bPaddingChanged = false;
    let outlineNeedsSync = false;

    const nextText = material.text;
    if (nextText !== prev.text) {
      prev.text = nextText;
      txt.text = nextText ?? "";
      bNeedUpdateBg = true;
    }

    const nextCenterX = material.center?.x ?? 0;
    const nextCenterY = material.center?.y ?? 0;
    if (nextCenterX !== prev.centerX || nextCenterY !== prev.centerY) {
      prev.centerX = nextCenterX;
      prev.centerY = nextCenterY;

      const cx = nextCenterX;
      const cy = nextCenterY;
      txt.anchorX = Math.floor(cx * 100) + "%";
      txt.anchorY = Math.floor((1 - cy) * 100) + "%";

      bNeedUpdateBg = true;
    }

    const nextVisible = (material.show ?? true) && active && !!txt.text;
    if (prev.visible !== nextVisible) {
      this.visible = nextVisible;
      prev.visible = nextVisible;
    }

    const nextDepthTest = material.depthTest ?? true;
    if (nextDepthTest !== prev.depthTest) {
      txt.material.depthTest = nextDepthTest;
      prev.depthTest = nextDepthTest;
    }

    const nextOffsetDepth = material.offsetDepth ?? true;
    if (nextOffsetDepth !== prev.offsetDepth) {
      this.userData.uOffsetDepth.value = nextOffsetDepth;
      prev.offsetDepth = nextOffsetDepth;
    }

    // Update color before visibility check - color should always be set
    const nextColor = material.color !== undefined ? material.color : 0xffffff;
    if (nextColor !== prev.color) {
      prev.color = nextColor;
      txt.color = nextColor;
    }

    if (!nextVisible) return;

    const nextPaddingX = material.padding?.x ?? 0;
    const nextPaddingY = material.padding?.y ?? 0;
    if (nextPaddingX !== prev.paddingX || nextPaddingY !== prev.paddingY) {
      this.userData.padding.x = nextPaddingX;
      this.userData.padding.y = nextPaddingY;
      prev.paddingX = nextPaddingX;
      prev.paddingY = nextPaddingY;
      bPaddingChanged = true;
    }

    const nextFont = material.font ?? "";
    if (material.font !== prev.font) {
      txt.font = nextFont;
      prev.font = nextFont;
      bNeedUpdateBg = true;
    }

    const nextScaleByDistance = material.scaleByDistance ? 1 : 0;
    if (nextScaleByDistance !== prev.scaleByDistance) {
      this.userData.scaleByDistance.value = nextScaleByDistance;
      prev.scaleByDistance = nextScaleByDistance;
    }

    const nextFontSize = material.size ?? 1.0;
    if (nextFontSize !== prev.fontSize) {
      this.userData.fontSizePx.value = nextFontSize;
      prev.fontSize = nextFontSize;
      outlineNeedsSync = this.recalculateOutlineParams() || outlineNeedsSync;
    }

    const nextBackgroundColor = material.backgroundColor
      ? new Color(material.backgroundColor)
      : undefined;
    if (nextBackgroundColor !== prev.backgroundColor) {
      this.userData.bgColor.value = nextBackgroundColor;
      prev.backgroundColor = nextBackgroundColor;
    }

    const nextBoarderColor = material.borderColor
      ? new Color(material.borderColor)
      : undefined;
    if (nextBoarderColor !== prev.borderColor) {
      this.userData.borderColor.value = nextBoarderColor;
      prev.borderColor = nextBoarderColor;
    }

    const nextBorderWidth = Math.max(material.borderWidth ?? 0.0, 0.0);
    if (nextBorderWidth !== prev.borderWidth) {
      this.userData.borderWidth.value = nextBorderWidth;
      prev.borderWidth = nextBorderWidth;
    }

    const nextCornerRadius = Math.max(material.cornerRadius ?? 0.0, 0.0);
    if (nextCornerRadius !== prev.cornerRadius) {
      this.userData.cornerRadius.value = nextCornerRadius;
      prev.cornerRadius = nextCornerRadius;
    }

    // Update outline properties
    const nextOutlineWidth = Math.max(material.outlineWidth ?? 0.0, 0.0);
    if (nextOutlineWidth !== prev.outlineWidthPx) {
      this.userData.outlineWidthPx.value = nextOutlineWidth;
      prev.outlineWidthPx = nextOutlineWidth;
      outlineNeedsSync = this.recalculateOutlineParams() || outlineNeedsSync;
    }

    const nextOutlineColor = material.outlineColor
      ? new Color(material.outlineColor)
      : undefined;
    if (nextOutlineColor !== prev.outlineColor) {
      txt.outlineColor = nextOutlineColor
        ? nextOutlineColor.getHex()
        : 0x000000;
      prev.outlineColor = nextOutlineColor;
    }

    const nextOutlineBlur = Math.max(material.outlineBlur ?? 0.0, 0.0);
    if (nextOutlineBlur !== prev.outlineBlurPx) {
      this.userData.outlineBlurPx.value = nextOutlineBlur;
      prev.outlineBlurPx = nextOutlineBlur;
      outlineNeedsSync = this.recalculateOutlineParams() || outlineNeedsSync;
    }

    const nextOutlineOffsetX = material.outlineOffset?.x ?? 0.0;
    const nextOutlineOffsetY = material.outlineOffset?.y ?? 0.0;
    if (
      nextOutlineOffsetX !== prev.outlineOffsetX ||
      nextOutlineOffsetY !== prev.outlineOffsetY
    ) {
      this.userData.outlineOffsetPx.x = nextOutlineOffsetX;
      this.userData.outlineOffsetPx.y = nextOutlineOffsetY;
      prev.outlineOffsetX = nextOutlineOffsetX;
      prev.outlineOffsetY = nextOutlineOffsetY;
      outlineNeedsSync = this.recalculateOutlineParams() || outlineNeedsSync;
    }

    const nextOutlineOpacity = material.outlineOpacity ?? 1.0;
    if (nextOutlineOpacity !== prev.outlineOpacity) {
      txt.outlineOpacity = nextOutlineOpacity;
      prev.outlineOpacity = nextOutlineOpacity;
    }

    if (bNeedUpdateBg || outlineNeedsSync) {
      txt.sync(() => {
        this.updateBackground();

        if (needRender) {
          needRender();
        }
      });
    } else if (bPaddingChanged) {
      this.updateBackground();
    }
  }

  updateBackground() {
    const txt = this.text;
    if (!txt) return;

    const textRenderInfo = txt.textRenderInfo;
    const txtWidth =
      textRenderInfo.blockBounds[2] - textRenderInfo.blockBounds[0];
    const txtHeight =
      textRenderInfo.blockBounds[3] - textRenderInfo.blockBounds[1];

    this.userData.fontSizeWorld.value = txtHeight;

    let bg = this.background;

    if (!this.userData.bgColor.value) {
      // remove background
      if (bg) {
        bg.geometry.dispose();
        bg.geometry.deleteAttribute("position");
        bg.geometry.deleteAttribute("uv");
        bg.geometry.deleteAttribute("normal");
        bg.geometry.index = null;
        this.remove(bg);
        this.background = undefined;
      }
      return;
    }

    bg = this._createBackground();

    const paddingRatioX =
      this.userData.padding.x / this.userData.fontSizePx.value;
    const paddingRatioY =
      this.userData.padding.y / this.userData.fontSizePx.value;
    const bgWwidth = txtWidth + txtHeight * paddingRatioX * 2;
    const bgHeight = txtHeight + txtHeight * paddingRatioY * 2;

    this.userData.bgSize.value.set(bgWwidth, bgHeight);

    // update anchor point
    const cx = this.userData.center?.x ?? 0.5;
    const cy = this.userData.center?.y ?? 0.0;

    const posArr = bg.geometry.attributes.position.array;
    posArr[0] = -cx * bgWwidth;
    posArr[1] = (1 - cy) * bgHeight;

    posArr[3] = (1 - cx) * bgWwidth;
    posArr[4] = (1 - cy) * bgHeight;

    posArr[6] = -cx * bgWwidth;
    posArr[7] = -cy * bgHeight;

    posArr[9] = (1 - cx) * bgWwidth;
    posArr[10] = -cy * bgHeight;

    const txtCx = (txtWidth * 0.5 - (0.5 - cx) * bgWwidth) / txtWidth;
    txt.anchorX = Math.floor(txtCx * 100) + "%";

    const txtCy = (txtHeight * 0.5 - (0.5 - cy) * bgHeight) / txtHeight;
    txt.anchorY = Math.floor((1 - txtCy) * 100) + "%";

    txt.material.needsUpdate = true;
    bg.geometry.attributes.position.needsUpdate = true;
    txt.sync();
  }

  setText(text: string) {
    if (!this.text) return;
    this.text.text = text;
    this.text.sync(() => {
      this.updateBackground();
    });
  }

  _setFeatureColor(color: Color): void {
    this.text.color = color.getHex();
  }

  _getFeatureColor() {
    return new Color(this.text.color as number);
  }

  _setFeatureShow(visible: boolean): void {
    this.visible = visible;
  }

  _setFrustumCulled(culled: boolean): void {
    // RTE mode must always have frustumCulled = false
    // because mesh position (0,0,0) doesn't match actual rendering position
    if (this.userData.useRTE) {
      this.text.frustumCulled = false;
      if (this.background) {
        this.background.frustumCulled = false;
      }
    } else {
      this.text.frustumCulled = culled;
      if (this.background) {
        this.background.frustumCulled = culled;
      }
    }
  }

  _setFeatureExtrudedHeight(_height: number): void {
    throw new Unimplemented();
  }

  _setFeatureHeight(height: number): void {
    this.userData.addHeight.value = height;
  }

  _setPickable(pickable: boolean) {
    this.userData.uPickable.value = pickable ? 1.0 : 0.0;

    this.children.forEach((item) => {
      // The frustum used for picking is only 1 pixel in size,
      // and both the text and its background dynamically change positions,
      // they risk being incorrectly culled. Therefore, frustumCulled must be set to false
      item.frustumCulled = !pickable;
    });
  }

  // Normalize px-based outline parameters into the font-relative units expected by Troika.
  private recalculateOutlineParams(): boolean {
    if (!this.text) return false;

    const fontSizePx = this.userData.fontSizePx?.value ?? 0.0;
    const outlineWidthPx = this.userData.outlineWidthPx?.value ?? 0.0;
    const outlineBlurPx = this.userData.outlineBlurPx?.value ?? 0.0;
    const outlineOffsetPx = this.userData.outlineOffsetPx ?? { x: 0.0, y: 0.0 };

    const invFontSize = fontSizePx > 0.0 ? 1.0 / fontSizePx : 0.0;

    const normalizedWidth = Math.max(outlineWidthPx * invFontSize, 0.0);
    const normalizedBlur = Math.max(outlineBlurPx * invFontSize, 0.0);
    const normalizedOffsetX = outlineOffsetPx.x * invFontSize;
    const normalizedOffsetY = outlineOffsetPx.y * invFontSize;

    let changed = false;

    if (this.text.outlineWidth !== normalizedWidth) {
      this.text.outlineWidth = normalizedWidth;
      changed = true;
    }

    if (this.text.outlineBlur !== normalizedBlur) {
      this.text.outlineBlur = normalizedBlur;
      changed = true;
    }

    if (this.text.outlineOffsetX !== normalizedOffsetX) {
      this.text.outlineOffsetX = normalizedOffsetX;
      changed = true;
    }

    if (this.text.outlineOffsetY !== normalizedOffsetY) {
      this.text.outlineOffsetY = normalizedOffsetY;
      changed = true;
    }

    return changed;
  }
}
