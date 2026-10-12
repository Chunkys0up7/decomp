import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "test-results", "playwright-report", "sources", "out"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // Scrollable regions (publish table, JSON preview) must be keyboard-reachable (A11Y-10).
      "jsx-a11y/no-noninteractive-tabindex": ["error", { tags: [], roles: ["tabpanel", "region"] }],
    },
  },
  {
    // TEST-25: user-facing text comes from src/app/copy.ts. JSX text may only be punctuation or symbols.
    files: ["src/components/**/*.tsx", "src/screens/**/*.tsx", "src/app/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "JSXText[value=/[A-Za-z]/]", message: "Put user-facing text in src/app/copy.ts (TEST-25)." },
      ],
    },
  },
);
