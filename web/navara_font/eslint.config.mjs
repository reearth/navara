import commonConfig from "../eslint.config.common.mjs";

/** @type { import("eslint").Linter.Config[] } */
export default [
  ...commonConfig,
  {
    files: ["**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
];
