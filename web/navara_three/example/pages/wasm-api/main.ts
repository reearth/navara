import ThreeView from "@navara/three";

import { run, type LayerDescriptions } from "./run";

const div = document.createElement("div");
div.id = "navara-root";
div.style.width = "100vw";
div.style.height = "100vh";

const canvas = document.createElement("canvas");
canvas.id = "navara-canvas";
canvas.style.width = "100%";
canvas.style.height = "100%";

div.appendChild(canvas);
document.body.appendChild(div);

const view = new ThreeView<LayerDescriptions>({
  canvas,
  debug: true,
});
run(view, canvas);
