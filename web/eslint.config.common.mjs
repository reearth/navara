import { globalIgnores } from "eslint/config";
import reearthConfig from "eslint-config-reearth";

/** @type { import("eslint").Linter.Config[] } */
export default [
  ...reearthConfig("navara_three"),
  {
    rules: {
      "import/no-extraneous-dependencies": "off",
      // The prefer-top-level fixer (enabled by eslint-config-reearth 0.4.0)
      // interacts badly with @typescript-eslint/consistent-type-imports and
      // moves value imports into `import type` statements, breaking runtime
      // code. Keep the repo's inline `type` specifier style instead.
      "import/consistent-type-specifier-style": "off",
      // Disabled: the `separate-type-imports` fixer in typescript-eslint
      // 8.60-8.65 wraps a whole mixed import (values + inline type specifiers)
      // in `import type`, type-erasing runtime values. Inline `type` specifiers
      // are purely stylistic (type erasure is driven by the compiler, not this
      // rule), so rather than churn every import to satisfy it, turn it off.
      "@typescript-eslint/consistent-type-imports": "off",
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
