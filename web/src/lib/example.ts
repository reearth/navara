import {
  DirectionalLight,
  MeshStandardMaterial,
  TextureLoader,
  type Scene,
  DoubleSide,
  SphereGeometry,
  Mesh,
} from "three";

import texture from "./earthmap1k.jpg";

export function initScene(scene: Scene) {
  const directionalLight = new DirectionalLight(0xffffff);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);

  const material = new MeshStandardMaterial({
    map: new TextureLoader().load(texture),
    side: DoubleSide,
  });

  const geometry = new SphereGeometry(300, 30, 30);
  const earthMesh = new Mesh(geometry, material);
  scene.add(earthMesh);
}
