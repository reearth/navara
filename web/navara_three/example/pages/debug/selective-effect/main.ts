import ThreeView from "@navara/three";
import type { DefaultDeclarations } from "@navara/three_default_plugin";

import { run } from "./run";

const view = new ThreeView<DefaultDeclarations>({
  debug: true,
  shadow: true,
});
run(view);
