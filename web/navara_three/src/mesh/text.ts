import type { TextMaterial as NavaraTextMaterial } from "@navara/engine";
import BatchDefinitioin from "@shaders/glsl/chunks/batch_definition.glsl";
import BillboardMatrix from "@shaders/glsl/chunks/billboardMat.glsl";
import Pick from "@shaders/glsl/chunks/pick.glsl";
import PixelToWorld from "@shaders/glsl/chunks/pixelToWorld.glsl";
import SdRoundedBox from "@shaders/glsl/chunks/sdRoundedBox.glsl";
import {
  Color,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector2,
  Vector3,
} from "three";
import { Text } from "troika-three-text";

import type { CommonUniforms } from "../uniforms";
import { createReplacer } from "../utils";

import type { FeatureMesh } from "./featureMesh";

export class TextMesh extends Group implements FeatureMesh {
  text: Text;
  background?: Mesh<PlaneGeometry, MeshBasicMaterial>;

  constructor(
    meshMaterial: NavaraTextMaterial,
    uniforms: CommonUniforms,
    batchId: number,
    selected: boolean,
  ) {
    super();

    this.text = new Text();

    this.userData.scaleByDistance = {
      value: meshMaterial.scale_by_distance ? 1.0 : 0.0,
    };
    this.userData.fontSizePx = {
      value: meshMaterial.size ?? 1.0,
    };
    this.userData.bgColor = {
      value: meshMaterial.background_color
        ? new Color(meshMaterial.background_color)
        : undefined,
    };
    this.userData.borderColor = {
      value: meshMaterial.border_color
        ? new Color(meshMaterial.border_color)
        : undefined,
    };
    this.userData.borderWidth = {
      value: meshMaterial.border_width ?? 0.0,
    };
    this.userData.cornerRadius = {
      value: meshMaterial.corner_radius ?? 0.0,
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
    this.userData.isPicked = selected;
    this.userData.batchId = batchId;
    this.userData.highlightColor = uniforms?.highlightColor?.value;
    this.visible = meshMaterial.show ?? true;

    this.initText();
  }

  private initText() {
    const txt = this.text;
    txt.fontSize = 1;

    (txt.material as Material).onBeforeCompile = (shader) => {
      shader.uniforms.nvr_uScaleByDistance = this.userData.scaleByDistance;
      shader.uniforms.nvr_uFontSizePx = this.userData.fontSizePx;
      shader.uniforms.nvr_uFontSizeWorld = this.userData.fontSizeWorld;
      shader.uniforms.nvr_uBatchId = { value: this.userData.batchId };
      shader.uniforms.nvr_uPickable = this.userData.uPickable;
      shader.uniforms.nvr_uFov = this.userData.fov;
      shader.uniforms.nvr_uScreenHeightPx = this.userData.screenHeightPx;

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
            ${BillboardMatrix}
            ${PixelToWorld}
            `,
        )
        .replace(
          `gl_Position = projectionMatrix * mvPosition;`,
          `
            float scaleFactor = nvr_uFontSizePx;
            if (nvr_uScaleByDistance > 0.0) {
              vec4 worldPosition = modelMatrix * vec4(position, 1.0);
              float worldSize = nvr_pxToWorld(nvr_uFontSizePx, nvr_uFov, nvr_uScreenHeightPx, worldPosition.xyz, cameraPosition);
              scaleFactor = worldSize / nvr_uFontSizeWorld;
            }
      
            mat4 billboardMatrix = nvr_getBillboardMat(scaleFactor);
            vec4 newMvPosition = billboardMatrix * vec4(transformed, 1.0);
      
            gl_Position = projectionMatrix * newMvPosition;
            `,
        ).source;

      shader.fragmentShader = createReplacer(shader.fragmentShader)
        .replace(
          `void main() {`,
          `
      ${BatchDefinitioin}
      ${Pick}
      void main() {
            `,
        )
        .replace(
          `//!END_POST_CHUNK`,
          `//!END_POST_CHUNK
            if (nvr_uPickable > 0.0) {
              vec3 pickColor = nvr_batchIdToColor(nvr_uBatchId);
              gl_FragColor = vec4(pickColor.xyz, 1.0);
            }`,
        ).source;
    };

    this.text = txt;
    this.add(txt);

    return this.text;
  }

  _createBackground() {
    if (this.background) return this.background;

    const backgroundMaterial = new MeshBasicMaterial();
    const background = new Mesh(new PlaneGeometry(), backgroundMaterial);

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

      shader.vertexShader = createReplacer(shader.vertexShader)
        .replace(
          `void main() {`,
          `
        uniform float nvr_uScaleByDistance;
        uniform float nvr_uFontSizePx;
        uniform float nvr_uFontSizeWorld;
        uniform float nvr_uFov;
        uniform float nvr_uScreenHeightPx;
        out vec2 vUv;
        ${BillboardMatrix}
        ${PixelToWorld}
        void main() {
          vUv = uv;
        `,
        )
        .replace(
          `#include <fog_vertex>`,
          `
        #include <fog_vertex>
  
        float scaleFactor = nvr_uFontSizePx;
        if (nvr_uScaleByDistance > 0.0) {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          float worldSize = nvr_pxToWorld(nvr_uFontSizePx, nvr_uFov, nvr_uScreenHeightPx, worldPosition.xyz, cameraPosition);
          scaleFactor = worldSize / nvr_uFontSizeWorld;
        }
  
        mat4 billboardMatrix = nvr_getBillboardMat(scaleFactor);
        vec4 newMvPosition = billboardMatrix * vec4(transformed, 1.0);
  
        gl_Position = projectionMatrix * newMvPosition;
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
        `,
        ).source;
    };

    background.onBeforeRender = function (
      _renderer,
      _scene,
      camera,
      _geometry,
      _material,
      _group,
    ) {
      if (this?.parent) {
        const worldPosition = new Vector3();
        this.parent.getWorldPosition(worldPosition);

        const direction = new Vector3();
        direction.subVectors(worldPosition, camera.position).normalize();
        this.position.copy(direction.multiplyScalar(10));
      }
    };

    this.background = background;
    this.add(background);

    return this.background;
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

    const nextColor = material.color ?? "#ffffff";
    if (nextColor !== prev.color) {
      prev.color = nextColor;
      if (this.userData.isPicked) {
        txt.color = this.userData.highlightColor;
      } else {
        txt.color = nextColor;
      }
    }

    const nextScaleByDistance = material.scale_by_distance ? 1 : 0;
    if (nextScaleByDistance !== prev.scaleByDistance) {
      this.userData.scaleByDistance.value = nextScaleByDistance;
      prev.scaleByDistance = nextScaleByDistance;
    }

    const nextFontSize = material.size ?? 1.0;
    if (nextFontSize !== prev.fontSize) {
      this.userData.fontSizePx.value = nextFontSize;
      prev.fontSize = nextFontSize;
    }

    const nextBackgroundColor = material.background_color
      ? new Color(material.background_color)
      : undefined;
    if (nextBackgroundColor !== prev.backgroundColor) {
      this.userData.bgColor.value = nextBackgroundColor;
      prev.backgroundColor = nextBackgroundColor;
    }

    const nextBoarderColor = material.border_color
      ? new Color(material.border_color)
      : undefined;
    if (nextBoarderColor !== prev.borderColor) {
      this.userData.borderColor.value = nextBoarderColor;
      prev.borderColor = nextBoarderColor;
    }

    const nextBorderWidth = Math.max(material.border_width ?? 0.0, 0.0);
    if (nextBorderWidth !== prev.borderWidth) {
      this.userData.borderWidth.value = nextBorderWidth;
      prev.borderWidth = nextBorderWidth;
    }

    const nextCornerRadius = Math.max(material.corner_radius ?? 0.0, 0.0);
    if (nextCornerRadius !== prev.cornerRadius) {
      this.userData.cornerRadius.value = nextCornerRadius;
      prev.cornerRadius = nextCornerRadius;
    }

    const nextDepthTest = material.depth_test ?? true;
    if (nextDepthTest !== prev.depthTest) {
      txt.material.depthTest = nextDepthTest;
      prev.depthTest = nextDepthTest;
    }

    if (bNeedUpdateBg) {
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
    this.text.material.color.set(color);
  }

  _getFeatureColor() {
    return this.text.material.color;
  }

  _setFrustumCulled(culled: boolean): void {
    this.text.frustumCulled = culled;
    if (this.background) {
      this.background.frustumCulled = culled;
    }
  }
}
