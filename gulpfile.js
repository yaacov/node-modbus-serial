"use strict";

const gulp = require("gulp");
const pump = require("pump");
const jsdoc = require("gulp-jsdoc3");
const clean = require("gulp-clean");

gulp.task("default", function() {
    // place code for your default task here
});

gulp.task("docs", ["doc", "docExamples"]);
gulp.task("build", ["apis", "ports", "servers", "utils"]);
gulp.task("publish", ["build", "docs"]);

gulp.task("clean", function() {
    return gulp.src(["modbus-serial", "docs/gen"])
        .pipe(clean({ force: true }));
});

gulp.task("doc", function(cb) {
    gulp.src(["README.md", "apis/**/*.js", "ports/**/*.js", "servers/**/*.js", "utils/**/*.js"], { read: false })
        .pipe(jsdoc(cb));
});

gulp.task("docExamples", function() {
    return gulp.src("examples/**/*").pipe(gulp.dest("docs/gen/examples"));
});

gulp.task("apis", function(cb) {
    pump([
        gulp.src("apis/**/*.js"),
        gulp.dest("modbus-serial/apis")
    ],
    cb
    );
});

gulp.task("ports", function(cb) {
    pump([
        gulp.src("ports/**/*.js"),
        gulp.dest("modbus-serial/ports")
    ],
    cb
    );
});

gulp.task("servers", function(cb) {
    pump([
        gulp.src("servers/**/*.js"),
        gulp.dest("modbus-serial/servers")
    ],
    cb
    );
});

gulp.task("utils", function(cb) {
    pump([
        gulp.src("utils/**/*.js"),
        gulp.dest("modbus-serial/utils")
    ],
    cb
    );
});
