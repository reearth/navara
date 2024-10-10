import reearthConfig from "eslint-config-reearth";

/** @type { import("eslint").Linter.Config[] } */
export default [
  ...reearthConfig("navara_three"),
  {
    ignores: ["dist"],
  },
];
