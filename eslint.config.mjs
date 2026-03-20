/**
 * ESLint flat config: @eslint/js recommended + minimal project overrides.
 */
import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import globals from "globals";

const ECMA_VERSION = 2022;

export default defineConfig([
    {
        ignores: [
            "**/node_modules/**",
            "**/coverage/**",
            "**/.nyc_output/**"
        ]
    },
    js.configs.recommended,
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: ECMA_VERSION,
            globals: globals.node,
            sourceType: "commonjs"
        }
    },
    {
        files: ["**/*.mjs"],
        languageOptions: {
            ecmaVersion: ECMA_VERSION,
            globals: globals.nodeBuiltin,
            sourceType: "module"
        }
    },
    {
        files: ["test/**/*.js"],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.mocha
            }
        }
    },
    {
        rules: {
            // Allow unused catch bindings (e.g. try { require(...) } catch (err) {})
            "no-unused-vars": ["error", { caughtErrors: "none" }]
        }
    }
]);
