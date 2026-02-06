const js = require("@eslint/js")
const tseslint = require("typescript-eslint")
const next = require("@next/eslint-plugin-next")
const tailwindcss = require("eslint-plugin-tailwindcss")
const react = require("eslint-plugin-react")
const reactHooks = require("eslint-plugin-react-hooks")

module.exports = [
  {
    ignores: [
      "dist/**",
      ".cache/**",
      "public/**",
      "node_modules/**",
      "*.esm.js",
      ".next/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  {
    files: ["**/*.{js,cjs,jsx,ts,tsx}"],
    languageOptions: {
      globals: {
        process: "readonly",
        module: "readonly",
        require: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        global: "readonly",
      },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["**/*.{ts,tsx}"],
  })),
  next.configs["core-web-vitals"],
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
      "@typescript-eslint": tseslint.plugin,
      tailwindcss,
    },
    rules: {
      // Next.js specific
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-img-element": "warn",

      // React
      "react/no-array-index-key": "warn",

      // TypeScript
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/consistent-type-imports": "off",

      // General code quality
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-duplicate-imports": "error",

      // Tailwind
      "tailwindcss/no-custom-classname": "off",
      "tailwindcss/classnames-order": "warn",
    },
    settings: {
      react: {
        version: "detect",
      },
      tailwindcss: {
        callees: ["cn"],
        config: "tailwind.config.js",
      },
    },
  },
  {
    files: ["**/*.{js,cjs,jsx,ts,tsx}"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: [
      "eslint.config.js",
      "postcss.config.js",
      "tailwind.config.js",
      "prettier.config.js",
      "jest.config.js",
      "jest.setup.js",
      "next.config.mjs",
      "env.mjs",
      "prisma/seed.ts",
      "config/**/*.ts",
      "e2e/**/*.ts",
      "app/lib/**/*.ts",
      "app/api/**/*.ts",
      "app/components/**/*.ts",
      "app/components/**/*.tsx",
      "app/hooks/**/*.ts",
      "app/types/**/*.ts",
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-non-null-asserted-optional-chain": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "no-useless-escape": "off",
      "no-undef": "off",
    },
  },
]
