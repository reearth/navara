import { defineConfig } from "vite";

import { commonConfig } from "../vite.config.common";

const common = commonConfig("NavaraWorker");

export default defineConfig({
  ...common,
});
