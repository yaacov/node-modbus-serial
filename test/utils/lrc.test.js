"use strict";
/* eslint-disable no-undef */

const expect = require("chai").expect;

const calculateLrc = require("./../../utils/lrc");

describe("Modbus LRC", function() {

    describe("lrc() - calculate checksum", function() {
        it("should calculate a valid checksum", function(done) {
            const buffer = Buffer.from("1103006B0003", "hex");
            const lrc = calculateLrc(buffer);
            expect(lrc).to.equal(126);
            done();
        });
    });

});
