import { RenderPass as PostProcessingRenderPass } from "postprocessing";

export class RenderPass extends PostProcessingRenderPass {
  get visible() {
    return this.enabled;
  }
  set visible(v: boolean) {
    this.enabled = v;
  }
}
