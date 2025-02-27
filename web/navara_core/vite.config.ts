import { defineConfig } from "vite";

import { commonConfig } from "../vite.config.common";

const common = commonConfig("NavaraCore");

export default defineConfig({
  ...common,
});
