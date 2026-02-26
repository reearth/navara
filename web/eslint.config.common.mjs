import { globalIgnores } from "eslint/config";
import reearthConfig from "eslint-config-reearth";

/** @type { import("eslint").Linter.Config[] } */
export default [
  ...reearthConfig("navara_three"),
  {
    rules: {
      "import/no-extraneous-dependencies": "off",
      // Ref: https://github.com/eslint/eslint/issues/19134#issuecomment-2480588649
      "@typescript-eslint/no-unused-expressions": [
        "error",
        {
          allowShortCircuit: true,
        },
      ],
    },
  },
  globalIgnores(["dist/**/*", "dist-example/**/*", "*/public"]),
];
