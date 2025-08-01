import { CascadedDirectionalLights } from "@navara/three_csm";
import type { WebGLRenderer } from "three";
import { ShadowMapViewer } from "three-stdlib";

import type { Scenes } from "./scene";

export class ShadowMapViewers {
  viewers: ShadowMapViewer[] = [];
  lights: Scenes["light"];
  enabled = false;

  constructor(lights: Scenes["light"]) {
    this.lights = lights;
  }

  render(renderer: WebGLRenderer) {
    if (!this.enabled || !renderer.shadowMap.enabled) return;

    if (this.viewers.length) {
      this.viewers.forEach((viewer) => {
        if (viewer) {
          viewer.render(renderer);
        }
      });
      return;
    }
    // Create shadow map viewers for debugging
    const csm = this.lights.children.find(
      (c) => c instanceof CascadedDirectionalLights,
    );
    if (!csm) return;
    const lights = csm.cascadedLights;
    lights.forEach((light, i) => {
      if (light.shadow.map && light.shadow.map.texture) {
        const viewer = new ShadowMapViewer(light);
        viewer.position.set(0, 100 * i);
        viewer.size.set(100, 100);
        this.viewers.push(viewer);
      }
    });
  }
}
