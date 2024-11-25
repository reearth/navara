import ThreeView from "@navara/three";

import { run } from "./run";

// const canvas = document.getElementById("canvas") as HTMLCanvasElement;
// if (!canvas) throw new Error("canvas element not found");
const view = new ThreeView({
  // canvas,
  debug: true,
});
run(view);
