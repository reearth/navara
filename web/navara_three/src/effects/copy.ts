import { CopyPass as PostProcessingCopyPass } from "postprocessing";

export class CopyPass extends PostProcessingCopyPass {
  get visible() {
    return this.enabled;
  }
  set visible(v: boolean) {
    this.enabled = v;
  }
}
