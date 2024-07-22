import type { BillboardMesh, PointMesh, RenderableFeature } from "navara";
import { Mesh, Sprite, SpriteMaterial, TextureLoader } from "three";
import PointFragShader from "@shaders/glsl/point.frag.glsl";

export function renderFeature(f: RenderableFeature): (Mesh | Sprite) | undefined {
  if (f.point) {
    return renderPoint(f.point);
  }
  if (f.billboard) {
    return renderBillboard(f.billboard);
  }
}

function renderPoint(m: PointMesh) {
  const material = new SpriteMaterial({ color: m.material.color, sizeAttenuation: false });
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "uniform vec2 center;",
        `
uniform vec2 center;
out vec2 sprite_uv;
`,
      )
      .replace(
        "gl_Position = projectionMatrix * mvPosition;",
        `
gl_Position = projectionMatrix * mvPosition;
sprite_uv = position.xy;
`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "uniform float opacity;",
        `
uniform float opacity;
in vec2 sprite_uv;
${PointFragShader}
`,
      )
      // Construct a circle from a plane with antialiasing.
      // The method of AA: https://stackoverflow.com/questions/12945277/drawing-antialiased-circle-using-shaders
      .replace(
        "#include <fog_fragment>",
        `
#include <fog_fragment>
gl_FragColor.a = nvr_circle_alpha(sprite_uv);
`,
      );
  };

  const sprite = new Sprite(material);
  sprite.center.set(m.material.center.x, m.material.center.y);

  return sprite;
}

function renderBillboard(m: BillboardMesh) {
  const map = new TextureLoader().load(m.material.url);
  const material = new SpriteMaterial({
    map: map,
    color: m.material.color,
    sizeAttenuation: false,
  });
  const sprite = new Sprite(material);
  sprite.center.set(m.material.center.x, m.material.center.y);

  return sprite;
}
