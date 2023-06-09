/** @type {import('prettier').Config} */
module.exports = {
  // Line settings
  endOfLine: "lf",
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,

  // Syntax settings
  semi: false,
  singleQuote: false,
  quoteProps: "as-needed",
  jsxSingleQuote: false,
  trailingComma: "es5",
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: "always",

  // Whitespace settings
  proseWrap: "preserve",

  // Import ordering
  importOrder: [
    "^(react/(.*)$)|^(react$)",
    "^(next/(.*)$)|^(next$)",
    "<BUILTIN_MODULES>",
    "<THIRD_PARTY_MODULES>",
    "",
    "^types$",
    "^@/types/(.*)$",
    "^@/config/(.*)$",
    "^@/app/lib/(.*)$",
    "^@/hooks/(.*)$",
    "^@/app/components/ui/(.*)$",
    "^@/components/(.*)$",
    "^@/styles/(.*)$",
    "^@/app/(.*)$",
    "",
    "^[./]",
  ],
  importOrderParserPlugins: ["typescript", "jsx", "decorators-legacy"],
  importOrderCaseSensitive: false,
  importOrderTypeScriptVersion: "5.0.0",
  plugins: ["@ianvs/prettier-plugin-sort-imports"],
}
