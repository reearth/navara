import { defineConfig } from "vite";

import { commonConfig } from "../vite.config.common";

export default defineConfig((env) => {
  const common = commonConfig("NavaraWorker", env);
  return {
    ...common,
  };
});
