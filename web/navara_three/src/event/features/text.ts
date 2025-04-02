import type { TextMaterial, TextMesh } from "@navara/engine";

import Pick from "@shaders/glsl/chunks/pick.glsl";
import BatchDefinitioin from "@shaders/glsl/chunks/batch_definition.glsl";
import BillboardMatrix from "@shaders/glsl/chunks/billboardMat.glsl";
import PixelToWorld from "@shaders/glsl/chunks/pixelToWorld.glsl";

import {
  Color,
  Mesh,
  Group,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector3,
  Vector2,
  Material,
} from "three";

import type { CommonUniforms } from "../../uniforms";
import type { RenderFlag } from "../../type";

import { Text } from "troika-three-text";

export async function renderText(m: TextMesh, uniforms: CommonUniforms) {
  if (m.material.text === "") {
    return;
  }

  const textGroup = new Group();
  textGroup.userData.isText = true;
  textGroup.userData.scaleByDistance = {
    value: m.material.scale_by_distance ? 1.0 : 0.0,
  };
  textGroup.userData.fontSizePx = {
    value: m.material.size ?? 1.0,
  };
  textGroup.userData.bgColor = {
    value: new Color(m.material.background_color ?? 0),
  };
  textGroup.userData.borderColor = {
    value: new Color(m.material.border_color),
  };
  textGroup.userData.borderWidth = {
    value: m.material.border_width ?? 0.0,
  };
  textGroup.userData.cornerRadius = {
    value: m.material.corner_radius ?? 0.0,
  };
  textGroup.userData.bgSize = {
    value: new Vector2(1.0, 1.0),
  };
  textGroup.userData.uPickable = {
    value: 0.0,
  };
  textGroup.userData.center = {
    x: m.material?.center?.x ?? 0.5,
    y: m.material?.center?.y ?? 0,
  };
  textGroup.userData.fontSizeWorld = {
    value: 0.0,
  };
  textGroup.userData.padding = {
    x: m.material?.padding?.x ?? 0.5,
    y: m.material?.padding?.y ?? 0,
  };
  textGroup.userData.fov = uniforms?.fov;
  textGroup.userData.screenHeightPx = uniforms?.screenHeightPx;
  textGroup.userData.isPicked = m.geometry.selected;
  textGroup.userData.batchId = m.geometry.batch_id ?? 0;
  textGroup.userData.highlightColor = uniforms?.highlightColor?.value;
  textGroup.visible = m.material.show ?? true;

  updateText(textGroup, m.material);

  return textGroup;
}

export function updateText(
  root: Group,
  material: TextMaterial,
  needRender?: () => void,
) {
  let txt = root.children.find((item) => item instanceof Text) as Text;
  if (!txt) {
    txt = createText(root);
  }

  let bNeedUpdateBg = false;
  let bPaddingChanged = false;

  if (material.text !== root.userData.text) {
    root.userData.text = material.text;
    bNeedUpdateBg = true;
  }

  if (
    material.center &&
    (material.center.x != root.userData.center.x ||
      material.center.y != root.userData.center.y)
  ) {
    root.userData.center.x = material.center.x;
    root.userData.center.y = material.center.y;
    bNeedUpdateBg = true;
  }

  if (
    material.padding &&
    (material.padding.x != root.userData.padding.x ||
      material.padding.y != root.userData.padding.y)
  ) {
    root.userData.padding.x = material.padding.x;
    root.userData.padding.y = material.padding.y;
    bPaddingChanged = true;
  }

  if (material.font !== root.userData.font) {
    root.userData.font = material.font;
    bNeedUpdateBg = true;
  }

  root.userData.fontColor = material.color;
  root.userData.depthTest = material.depth_test;
  root.userData.scaleByDistance.value = material.scale_by_distance ? 1.0 : 0.0;
  root.userData.fontSizePx.value = material.size ?? 1.0;
  root.userData.bgColor.value = new Color(material.background_color);
  root.userData.borderColor.value = new Color(material.border_color);
  root.userData.borderWidth.value = Math.max(material.border_width ?? 0.0, 0.0);
  root.userData.cornerRadius.value = Math.max(
    material.corner_radius ?? 0.0,
    0.0,
  );

  txt.text = material.text ?? "";

  txt.material.depthTest = material.depth_test ?? true;

  if (material.font) {
    txt.font = material.font;
  }

  if (root.userData.isPicked) {
    txt.color = root.userData.highlightColor;
  } else {
    txt.color = material.color ?? "#ffffff";
  }

  if (bNeedUpdateBg) {
    const cx = root.userData.center.x;
    const cy = root.userData.center.y;
    txt.anchorX = Math.floor(cx * 100) + "%";
    txt.anchorY = Math.floor((1 - cy) * 100) + "%";

    txt.sync(() => {
      updateBackground(root, txt, material);

      if (needRender) {
        needRender();
      }
    });
  } else if (bPaddingChanged) {
    updateBackground(root, txt, material);
  }
}

function createText(root: Group) {
  const txt = new Text();
  txt.fontSize = 1;

  (txt.material as Material).onBeforeCompile = (shader) => {
    shader.uniforms.nvr_uScaleByDistance = root.userData.scaleByDistance;
    shader.uniforms.nvr_uFontSizePx = root.userData.fontSizePx;
    shader.uniforms.nvr_uFontSizeWorld = root.userData.fontSizeWorld;
    shader.uniforms.nvr_uBatchId = { value: root.userData.batchId };
    shader.uniforms.nvr_uPickable = root.userData.uPickable;
    shader.uniforms.nvr_uFov = root.userData.fov;
    shader.uniforms.nvr_uScreenHeightPx = root.userData.screenHeightPx;

    shader.vertexShader = shader.vertexShader.replace(
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
    );

    shader.vertexShader = shader.vertexShader.replace(
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
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      `void main() {`,
      `
${BatchDefinitioin}
${Pick}
void main() {
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      `
if (edgeAlpha == 0.0) {
  discard;
}
`,
      `
if (edgeAlpha == 0.0) {
  if (nvr_uPickable > 0.0) {
    vec3 pickColor = nvr_batchIdToColor(nvr_uBatchId);
    gl_FragColor = vec4(pickColor.xyz, 1.0);
    return;
  }
  else{
    discard;
  }
}
`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      `//!END_POST_CHUNK`,
      `//!END_POST_CHUNK
      if (nvr_uPickable > 0.0) {
        vec3 pickColor = nvr_batchIdToColor(nvr_uBatchId);
        gl_FragColor = vec4(pickColor.xyz, 1.0);
      }`,
    );
  };

  root.add(txt);

  return txt;
}

function updateBackground(root: Group, txt: Text, material: TextMaterial) {
  const textRenderInfo = txt.textRenderInfo;
  const txtWidth =
    textRenderInfo.blockBounds[2] - textRenderInfo.blockBounds[0];
  const txtHeight =
    textRenderInfo.blockBounds[3] - textRenderInfo.blockBounds[1];

  root.userData.fontSizeWorld.value = txtHeight;

  let bg = root.children.find((item) => !(item instanceof Text)) as Mesh;

  if (!material.background_color) {
    // remove background
    if (bg) {
      bg.geometry.dispose();
      bg.geometry.deleteAttribute("position");
      bg.geometry.deleteAttribute("uv");
      bg.geometry.deleteAttribute("normal");
      bg.geometry.index = null;
      root.remove(bg);
    }
    return;
  }

  if (!bg) {
    bg = createBackground(root);
  }

  const paddingRatioX =
    root.userData.padding.x / root.userData.fontSizePx.value;
  const paddingRatioY =
    root.userData.padding.y / root.userData.fontSizePx.value;
  const bgWwidth = txtWidth + txtHeight * paddingRatioX * 2;
  const bgHeight = txtHeight + txtHeight * paddingRatioY * 2;

  root.userData.bgSize.value.set(bgWwidth, bgHeight);

  // update anchor point
  const cx = material?.center?.x ?? 0.5;
  const cy = material?.center?.y ?? 0.0;

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

function createBackground(root: Group) {
  const backgroundMaterial = new MeshBasicMaterial();
  const background = new Mesh(new PlaneGeometry(), backgroundMaterial);

  background.material.onBeforeCompile = (shader) => {
    shader.uniforms.nvr_uScaleByDistance = root.userData.scaleByDistance;
    shader.uniforms.nvr_uFontSizePx = root.userData.fontSizePx;
    shader.uniforms.nvr_uFontSizeWorld = root.userData.fontSizeWorld;
    shader.uniforms.nvr_uCornerRadius = root.userData.cornerRadius;
    shader.uniforms.nvr_uFillColor = root.userData.bgColor;
    shader.uniforms.nvr_uBorderColor = root.userData.borderColor;
    shader.uniforms.nvr_uBorderWidth = root.userData.borderWidth;
    shader.uniforms.nvr_uGeomSize = root.userData.bgSize;
    shader.uniforms.nvr_uBatchId = { value: root.userData.batchId };
    shader.uniforms.nvr_uPickable = root.userData.uPickable;
    shader.uniforms.nvr_uFov = root.userData.fov;
    shader.uniforms.nvr_uScreenHeightPx = root.userData.screenHeightPx;

    shader.vertexShader = shader.vertexShader.replace(
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
    );

    shader.vertexShader = shader.vertexShader.replace(
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
    );

    shader.fragmentShader = shader.fragmentShader.replace(
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
      float sdRoundedBox(vec2 p, vec2 b, float r) {
          vec2 q = abs(p) - b + vec2(r);
          return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
      }
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      `#include <dithering_fragment>`,
      `
      #include <dithering_fragment>
        if (nvr_uPickable > 0.0) {
          vec3 pickColor = nvr_batchIdToColor(nvr_uBatchId);
          gl_FragColor = vec4(pickColor.xyz, 1.0);
          return;
        }

        vec2 uv = (vUv - 0.5) * nvr_uGeomSize;
        float border = nvr_uBorderWidth * nvr_uGeomSize.y;
        float cornerRadius = nvr_uCornerRadius * nvr_uGeomSize.y;

        float effectiveRadius = min(cornerRadius, min(nvr_uGeomSize.x, nvr_uGeomSize.y) * 0.5);
        vec2 b = nvr_uGeomSize * 0.5 - vec2(border);

        float d = sdRoundedBox(uv, b, effectiveRadius);

        if (d > border) {
          discard;
        }
        else if (d < 0.0){
          gl_FragColor = vec4(nvr_uFillColor, 1.0);
        }
        else{
          gl_FragColor = vec4(nvr_uBorderColor, 1.0);
        }
      `,
    );
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

  root.add(background);
  return background;
}

export function processTextChanged(
  obj: Group,
  material: TextMaterial,
  active: boolean,
  renderFlag: RenderFlag,
) {
  obj.scale.set(1, 1, 1);
  obj.visible = (material.show ?? true) && active;
  if (obj.visible) {
    updateText(obj, material, () => {
      renderFlag.forceUpdate = true;
    });
  }
}
