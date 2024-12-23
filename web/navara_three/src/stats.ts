import Stats from "stats.js";

type Renderer = {
  beginRender: () => void;
  endRender: () => {
    calls?: number;
    triangles?: number;
    memGeometries?: number;
  };
};

export class RendererStats {
  stats: Stats;
  renderer: Renderer;
  drawCalls: Stats.Panel;
  numTriangles: Stats.Panel;
  memGeometries: Stats.Panel;
  constructor(r: Renderer) {
    this.stats = new Stats();
    this.renderer = r;
    this.drawCalls = this.stats.addPanel(
      new Stats.Panel("Draws", "#0ff", "#002"),
    );
    this.numTriangles = this.stats.addPanel(
      new Stats.Panel("Triangles", "#0fff57", "#013a12"),
    );
    this.memGeometries = this.stats.addPanel(
      new Stats.Panel("Geometries", "#ffa100", "#301e00"),
    );
    this.stats.showPanel(0);
  }

  begin() {
    this.renderer.beginRender();
    this.stats.begin();
  }

  end() {
    const info = this.renderer.endRender();
    if (info.calls) {
      this.drawCalls.update(info.calls, 500);
    }
    if (info.triangles) {
      this.numTriangles.update(info.triangles, 500);
    }
    if (info.memGeometries) {
      this.memGeometries.update(info.memGeometries, 500);
    }
    this.stats.end();
  }

  get dom() {
    return this.stats.dom;
  }
}
