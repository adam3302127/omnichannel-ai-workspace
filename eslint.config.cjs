const eslint = require("@eslint/js");
const tseslint = require("typescript-eslint");

module.exports = [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  { ignores: ["dist/", "node_modules/"] },
];
