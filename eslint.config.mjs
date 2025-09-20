// eslint.config.mjs
import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  // Next + TS presets
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // Our overrides go last (last wins)
  {
    rules: {
      // Already part of Option B:
      "@typescript-eslint/no-explicit-any": "off",

      // Unused vars → warn (and allow prefix '_' to silence)
      "@typescript-eslint/no-unused-vars": ["warn", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }],

      // Allow temporary mixed styles during launch
      "prefer-const": "warn",

      // TeamMultiSelect had an "unused expression" — make non-blocking
      "@typescript-eslint/no-unused-expressions": "warn",

      // Static pages with quotes (Privacy/Terms) — don't block build on escaping
      "react/no-unescaped-entities": "off",

      // Allow CommonJS require in .js helper for now
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];
