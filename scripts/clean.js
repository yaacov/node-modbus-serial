"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
for (const rel of ["modbus-serial", path.join("docs", "gen")]) {
    fs.rmSync(path.join(root, rel), { recursive: true, force: true });
}
