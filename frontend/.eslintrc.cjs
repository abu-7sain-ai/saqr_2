module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      version: "detect",
    },
  },
  plugins: ["react", "react-hooks", "react-refresh"],
  extends: ["eslint:recommended", "plugin:react/recommended", "plugin:react-hooks/recommended", "prettier"],
  rules: {
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "no-unused-vars": "off",
    "react/no-unescaped-entities": "off",
    "react-hooks/exhaustive-deps": "off",
    "react-refresh/only-export-components": "off",
  },
  overrides: [
    {
      files: ["playwright.config.js", "vite.config.js", "vitest.config.js", "tests/**/*.{js,jsx}"],
      env: {
        node: true,
        browser: false,
      },
    },
  ],
};
