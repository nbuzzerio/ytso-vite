module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: ["eslint:recommended", "prettier"],
  ignorePatterns: ["dist", ".eslintrc.cjs", ".dev"],
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  overrides: [
    {
      files: ["*.ts", "*.tsx"],
      parser: "@typescript-eslint/parser",
      plugins: ["react-refresh"],
      extends: [
        "plugin:@typescript-eslint/recommended",
        "plugin:react-hooks/recommended",
        "prettier",
      ],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "react-refresh/only-export-components": [
          "warn",
          { allowConstantExport: true },
        ],
      },
    },
    {
      files: ["server/**/*.js", "database/**/*.js", "tests/**/*.{js,mjs}"],
      env: { browser: false, node: true },
      rules: {
        "no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
        ],
      },
    },
  ],
};
