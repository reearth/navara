import dts from "unplugin-dts/vite";
import { defineConfig } from "vite";
import tsconfig from "vite-tsconfig-paths";

import { commonConfig } from "../vite.config.common";

export default defineConfig((env) => {
  const common = commonConfig("NavaraWorker", env);
  return {
    ...common,
    plugins: [
      tsconfig({ configNames: ["tsconfig.build.json"] }),
      dts({ tsconfigPath: "./tsconfig.build.json" }),
    ],
  };
});
