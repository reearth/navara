import PointFragShader from "@shaders/glsl/point.frag.glsl";
import type { BillboardMesh, PointMesh, ModelMesh, RenderableFeature } from "navara";
import { Mesh, Sprite, SpriteMaterial, TextureLoader } from "three";
import { GLTFLoader } from "three-stdlib";

export function renderFeature(f: RenderableFeature): Promise<Mesh | Sprite> | undefined {
  if (f.point) {
    return renderPoint(f.point);
  }
  if (f.billboard) {
    return renderBillboard(f.billboard);
  }
  if (f.model) {
    return renderModel(f.billboard);
  }
}

async function renderPoint(m: PointMesh) {
  const material = new SpriteMaterial({
    color: m.material.color,
    depthTest: m.material.depth_test,
    sizeAttenuation: false,
    visible: m.material.show,
  });
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

async function renderBillboard(m: BillboardMesh) {
  const map = await new TextureLoader().loadAsync(m.material.url);

  const material = new SpriteMaterial({
    map: map,
    color: m.material.color,
    sizeAttenuation: false,
    depthTest: m.material.depth_test,
    visible: m.material.show,
  });
  const sprite = new Sprite(material);
  sprite.center.set(m.material.center.x, m.material.center.y);

  return sprite;
}

async function renderModel(m: ModelMesh) {
  const loader = new GLTFLoader();
    
  try {
      const model = await new Promise((resolve, reject) => {
          loader.load(
              m.material.url,
              (model) => resolve(model),
              undefined,
              (error) => reject(error)
          );
      });

      return model;
  } catch (error) {
      throw error;
  }
}