"use strict";
/* eslint-disable no-undef, no-console */

const net = require("net");

const client = net.connect({ host: process.argv[2], port: process.argv[3] }, () => {
	console.log("client connected");
	process.exit(33);
});
