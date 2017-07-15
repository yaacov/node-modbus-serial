"use strict";
/* eslint-disable no-undef, no-console */

const net = require("net");

const client = net.connect({ host: process.argv[2], port: process.argv[3] }, () => {
    process.send("Ready to be killed");
});

client.on("error", function() {
    // Nothing to do here...
});
