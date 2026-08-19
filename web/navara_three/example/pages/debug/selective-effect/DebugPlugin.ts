import ThreeView, { Plugin, type ViewContext } from "@navaramap/three";

import { setupDebugViews } from "./debugView";

export class DebugPlugin extends Plugin {
  private debugView?: ReturnType<typeof setupDebugViews>;

  async init(view: ThreeView, ctx: ViewContext): Promise<void> {
    const renderer = ctx.getRenderer();

    // The G-buffer target is rebuilt when the active effects change, so it is
    // re-fetched per frame instead of captured here.
    this.debugView = setupDebugViews(renderer, () => ({
      renderTarget: ctx.getRenderTarget(),
      effectIdsTexture: ctx.getEffectIdsTexture(),
      emissiveTexture: ctx.getEmissiveTexture(),
    }));

    view.on("postRender", () => {
      this.debugView?.renderDebugViews();
    });
  }

  setEnabled(enabled: boolean): void {
    this.debugView?.setEnabled(enabled);
  }
}
