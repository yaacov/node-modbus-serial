"use strict";
/* eslint-disable no-undef */

var lint = require("mocha-eslint");

var paths = [
    "index.js",
    "ports/**/*.js",
    "servers/**/*.js",
    "apis/**/*.js",
    "utils/**/*.js",
    "examples/**/*.js",
    "test/**/*.js"
];

var options = {
    // Specify style of output
    formatter: "compact", // Defaults to `stylish`
    timeout: 5000
};

// Run the tests
lint(paths, options);
