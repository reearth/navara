import ThreeView, { Plugin, type ViewContext } from "@navara/three";

import { setupDebugViews } from "./debugView";

export class DebugPlugin extends Plugin {
  private debugView?: ReturnType<typeof setupDebugViews>;

  async init(view: ThreeView, ctx: ViewContext): Promise<void> {
    const renderer = ctx.getRenderer();

    this.debugView = setupDebugViews(renderer, ctx.getRenderTarget());

    view.on("postRender", () => {
      this.debugView?.renderDebugViews();
    });
  }

  setEnabled(enabled: boolean): void {
    this.debugView?.setEnabled(enabled);
  }
}
