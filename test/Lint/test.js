"use strict";
/* eslint-disable no-undef */

const lint = require("mocha-eslint");

const paths = [
    "index.js",
    "ports/**/*.js",
    "servers/**/*.js",
    "apis/**/*.js",
    "utils/**/*.js",
    "examples/**/*.js",
    "test/**/*.js"
];

const options = {
    // Specify style of output
    formatter: "compact", // Defaults to `stylish`
    timeout: 5000
};

// Run the tests
lint(paths, options);
