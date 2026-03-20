"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const out = path.join(root, "modbus-serial");
fs.mkdirSync(out, { recursive: true });

for (const name of ["apis", "ports", "servers", "utils"]) {
    const src = path.join(root, name);
    const dest = path.join(out, name);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(src, dest, { recursive: true });
}
