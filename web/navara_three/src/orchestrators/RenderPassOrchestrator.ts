import { NamedIndexMap } from "@navara/core";
import { EffectComposer, Pass as PostProcessingPass } from "postprocessing";
import { HalfFloatType, Scene, WebGLRenderer, Group } from "three";

export type RenderPassOrchestratorOptions = {
  halfFloat?: boolean;
  multisampling?: number;
};

export type NamedPass = {
  name: string;
  pass: PostProcessingPass;
};

// Implementation policy:
// - Here we only manage Pass with an ordered Map mechanism.
// - When a Layer inserts with insertBefore/After, it inserts in the appropriate place.
// - If we render in order from the top, we can render while preserving dependencies.
// - As a preliminary step to the Layer mechanism, we want to be able to just freely add Pass from the ThreeView to the RenderPassOrchestrator.
// - Use NamedIndexMap for Pass management.

/**
 * Orchestrate rendering passes with ordered management and flexible insertion.
 */
export class RenderPassOrchestrator {
  lights = new Group();
  scenes = {
    mrt: new Scene(),
    globe: new Scene(),
    draped: new Scene(),
    opaque: new Scene(),
    transparent: new Scene(),
  };
  effectComposer: EffectComposer;

  private passMap = new NamedIndexMap<NamedPass>();

  constructor(renderer: WebGLRenderer, options: RenderPassOrchestratorOptions) {
    const combinedScene = new Scene();
    combinedScene.add(this.scenes.mrt);
    combinedScene.add(this.scenes.globe);
    combinedScene.add(this.lights);

    // Setup render pass
    this.effectComposer = new EffectComposer(renderer, {
      stencilBuffer: true,
      frameBufferType: (options.halfFloat ?? true) ? HalfFloatType : undefined,
      multisampling: options.multisampling,
    });
  }

  setSize(width: number, height: number) {
    this.effectComposer.setSize(width, height);
  }

  render() {
    this.effectComposer.render();
  }

  /**
   * Add a named pass to the end of the pass list.
   */
  addPass(name: string, pass: PostProcessingPass): void {
    const namedPass: NamedPass = { name, pass };
    this.passMap.add(namedPass);
    this.effectComposer.addPass(pass);
  }

  /**
   * Insert a pass before the specified target pass.
   */
  insertPassBefore(
    targetName: string,
    name: string,
    pass: PostProcessingPass,
  ): void {
    const namedPass: NamedPass = { name, pass };
    const targetIndex = this.passMap.insertBefore(targetName, namedPass);
    this.effectComposer.addPass(pass, targetIndex);
  }

  /**
   * Insert a pass after the specified target pass.
   */
  insertPassAfter(
    targetName: string,
    name: string,
    pass: PostProcessingPass,
  ): void {
    const namedPass: NamedPass = { name, pass };
    const targetIndex = this.passMap.insertAfter(targetName, namedPass);
    this.effectComposer.addPass(pass, targetIndex + 1);
  }

  /**
   * Remove a pass by name.
   */
  removePass(name: string): void {
    const targetPass = this.passMap.list.find((p) => p.name === name);
    if (!targetPass) {
      throw new Error(`Pass not found: ${name}`);
    }

    this.effectComposer.removePass(targetPass.pass);
    this.passMap.list = this.passMap.list.filter((p) => p.name !== name);
    this.rebuildIndexMap();
  }

  /**
   * Get a pass by name.
   */
  getPass(name: string): PostProcessingPass | undefined {
    return this.passMap.list.find((p) => p.name === name)?.pass;
  }

  /**
   * Get all pass names in order.
   */
  getPassNames(): string[] {
    return this.passMap.list.map((p) => p.name);
  }

  /**
   * Clear all passes.
   */
  clearPasses(): void {
    for (const namedPass of this.passMap.list) {
      this.effectComposer.removePass(namedPass.pass);
    }
    this.passMap.list = [];
    this.passMap.indexMap = {};
  }

  /**
   * Rebuild the index map after manual list modification.
   */
  private rebuildIndexMap(): void {
    this.passMap.indexMap = {};
    for (let i = 0; i < this.passMap.list.length; i++) {
      this.passMap.indexMap[this.passMap.list[i].name] = i;
    }
  }
}
