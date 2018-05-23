"use strict";
/* eslint-disable no-undef */

var expect = require("chai").expect;

var calculateLrc = require("./../../utils/lrc");

describe("Modbus LRC", function() {

    describe("lrc() - calculate checksum", function() {
        it("should calculate a valid checksum", function(done) {
            var buffer = Buffer.from("1103006B0003", "hex");
            var lrc = calculateLrc(buffer);
            expect(lrc).to.equal(126);
            done();
        });
    });

});
