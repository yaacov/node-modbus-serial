"use strict";

const expect = require("chai").expect;

const {
    MAX_RTU_FRAME_LENGTH,
    reportServerIdLength,
    readDeviceIdentificationLength
} = require("../../utils/response_length");

// basic device identification: "HUAWEI", "SUN2000", "V100R"
const FC43_RESPONSE = Buffer.from("112b0e01010000030006485541574549010753554e323030300205563130305277dd", "hex");
// first object empty
const FC43_EMPTY_OBJECT = Buffer.from("112b0e010100000200000103414243c831", "hex");
const FC17_RESPONSE = Buffer.from("11110501020304ff0f67", "hex");

describe("Modbus response length", function() {

    describe("readDeviceIdentificationLength() - FC 43", function() {
        it("should return the length of a complete response", function() {
            expect(readDeviceIdentificationLength(FC43_RESPONSE, 0)).to.equal(FC43_RESPONSE.length);
        });

        it("should know the length once the objects arrived, before the CRC", function() {
            const withoutCrc = FC43_RESPONSE.subarray(0, FC43_RESPONSE.length - 2);
            expect(readDeviceIdentificationLength(withoutCrc, 0)).to.equal(FC43_RESPONSE.length);
        });

        it("should return null while the header is incomplete", function() {
            expect(readDeviceIdentificationLength(FC43_RESPONSE.subarray(0, 7), 0)).to.equal(null);
        });

        it("should return null while an object header is incomplete", function() {
            expect(readDeviceIdentificationLength(FC43_RESPONSE.subarray(0, 9), 0)).to.equal(null);
        });

        it("should accept an object of length zero", function() {
            expect(readDeviceIdentificationLength(FC43_EMPTY_OBJECT, 0)).to.equal(FC43_EMPTY_OBJECT.length);
        });

        it("should count from the start of the response, not of the buffer", function() {
            const buffer = Buffer.concat([Buffer.from("2054ff", "hex"), FC43_RESPONSE]);
            expect(readDeviceIdentificationLength(buffer, 3)).to.equal(FC43_RESPONSE.length);
        });

        it("should report an object list longer than an RTU frame without waiting for it", function() {
            // two objects announced, the first one alone has 255 bytes
            const buffer = Buffer.from("112b0e010100000200ff", "hex");
            expect(readDeviceIdentificationLength(buffer, 0)).to.be.above(MAX_RTU_FRAME_LENGTH);
        });
    });

    describe("reportServerIdLength() - FC 17", function() {
        it("should return the length from the byte count", function() {
            expect(reportServerIdLength(FC17_RESPONSE, 0)).to.equal(FC17_RESPONSE.length);
        });

        it("should return null while the byte count is missing", function() {
            expect(reportServerIdLength(FC17_RESPONSE.subarray(0, 2), 0)).to.equal(null);
        });

        it("should count from the start of the response, not of the buffer", function() {
            const buffer = Buffer.concat([Buffer.from("20", "hex"), FC17_RESPONSE]);
            expect(reportServerIdLength(buffer, 1)).to.equal(FC17_RESPONSE.length);
        });

        it("should report a byte count beyond an RTU frame", function() {
            expect(reportServerIdLength(Buffer.from("1111ff", "hex"), 0)).to.be.above(MAX_RTU_FRAME_LENGTH);
        });
    });

});
