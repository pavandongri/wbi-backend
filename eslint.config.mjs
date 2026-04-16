// @ts-check

import eslint from "@eslint/js";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    ignores: ["dist/**", "node_modules/**", "logs/**", "coverage/**", "*.config.js", "*.config.mjs"]
  },

  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  prettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node
      },

      parserOptions: {
        projectService: {
          allowDefaultProject: ["drizzle.config.ts"]
        },
        tsconfigRootDir: import.meta.dirname
      },

      sourceType: "module"
    }
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/restrict-template-expressions": "off",
      "prettier/prettier": ["error", { endOfLine: "lf" }]
    }
  }
]);
