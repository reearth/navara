import Stats from "stats.js";

type Renderer = {
  beginDrawCalls: () => void;
  endDrawCalls: () => number;
};

export class RendererStats {
  stats: Stats;
  renderer: Renderer;
  drawCalls: Stats.Panel;
  constructor(r: Renderer) {
    this.stats = new Stats();
    this.renderer = r;
    this.drawCalls = this.stats.addPanel(
      new Stats.Panel("Draws", "#0ff", "#002"),
    );
    this.stats.showPanel(0);
  }

  begin() {
    this.renderer.beginDrawCalls();
    this.stats.begin();
  }

  end() {
    this.drawCalls.update(this.renderer.endDrawCalls(), 500);
    this.stats.end();
  }

  get dom() {
    return this.stats.dom;
  }
}
