"use strict";
/* eslint-disable no-undef */

var expect = require("chai").expect;
var mockery = require("mockery");

var LONG_MSG = "010380018301830183018301830183018301830183018301830183018301830\
1830183018301830183018301830183018301830183018301830183018301830183018301830183\
0183018301830183018301830183018301830183018301830183018301830183018301830183018\
3018301830183018301830183018301830183018346e0";

describe("Modbus Ascii port", function() {
    var port;

    before(function() {
        var mock = require("./../mocks/SerialPortMock");
        mockery.resetCache();
        mockery.enable({ warnOnReplace: false, useCleanCache: true, warnOnUnregistered: false });
        mockery.registerMock("serialport", mock);
        var AsciiPort = require("./../../ports/asciiport");
        port = new AsciiPort(
            "/dev/null",
            { startOfSlaveFrameChar: 0x3E }  // optional slave frame char ('>')
        );
    });

    after(function() {
        mockery.disable();
    });

    afterEach(function() {
        port.close();
    });

    describe("#isOpen", function() {
        it("should not be open before #open", function() {
            expect(port.isOpen).to.be.false;
        });

        it("should be open after #open", function(done) {
            port.open(function() {
                expect(port.isOpen).to.be.true;
                done();
            });
        });

        it("should not be open after #close", function(done) {
            port.open(function() {
                port.close(function() {
                    expect(port.isOpen).to.be.false;
                    done();
                });
            });
        });
    });

    describe("data handler", function() {
        it("should return a valid Modbus ASCII message", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("110306ae415652434049ad");
                done();
            });
            port.open(function() {
                port.write(Buffer.from("1103006B00037687", "hex"));
                setTimeout(function() {
                    port._client.receive(Buffer.from(">", "ascii"));  // changed slave frame char
                    port._client.receive(Buffer.from("11", "ascii"));
                    port._client.receive(Buffer.from("03", "ascii"));
                    port._client.receive(Buffer.from("06", "ascii"));
                    port._client.receive(Buffer.from("AE", "ascii"));
                    port._client.receive(Buffer.from("41", "ascii"));
                    port._client.receive(Buffer.from("56", "ascii"));
                    port._client.receive(Buffer.from("52", "ascii"));
                    port._client.receive(Buffer.from("43", "ascii"));
                    port._client.receive(Buffer.from("40", "ascii"));
                    port._client.receive(Buffer.from("CC", "ascii"));
                    port._client.receive(Buffer.from("\r\n", "ascii"));
                });
            });
        });

        it("should return a valid Modbus ASCII exception", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("1183044136");
                done();
            });
            port.open(function() {
                port.write(Buffer.from("1103006B00037687", "hex"));
                setTimeout(function() {
                    port._client.receive(Buffer.from(">", "ascii"));
                    port._client.receive(Buffer.from("11", "ascii"));
                    port._client.receive(Buffer.from("83", "ascii"));
                    port._client.receive(Buffer.from("04", "ascii"));
                    port._client.receive(Buffer.from("68", "ascii"));
                    port._client.receive(Buffer.from("\r\n", "ascii"));
                });
            });
        });

        it("Special data package, should return a valid Modbus RTU message", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal(LONG_MSG);
                done();
            });
            port.open(function() {
                port.write(Buffer.from("010300000040443A", "hex"));
                setTimeout(function() {
                    port._client.receive(Buffer.from(">", "ascii"));
                    for (var i = 0; i < (LONG_MSG.length - 4); i += 2) {
                        port._client.receive(Buffer.from(LONG_MSG.slice(i, i + 2), "ascii"));
                    }
                    port._client.receive(Buffer.from("7C", "ascii"));
                    port._client.receive(Buffer.from("\r\n", "ascii"));
                });
            });
        });

        it("Illegal start chars, should synchronize to valid Modbus ASCII message", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("110306ae415652434049ad");
                done();
            });
            port.open(function() {
                port.write(Buffer.from("1103006B00037687", "hex"));
                setTimeout(function() {
                    port._client.receive(Buffer.from("20", "ascii")); // illegal char
                    port._client.receive(Buffer.from("54", "ascii")); // illegal char
                    port._client.receive(Buffer.from("54", "ascii")); // illegal char
                    port._client.receive(Buffer.from("FF", "ascii")); // illegal char
                    port._client.receive(Buffer.from(">", "ascii"));
                    port._client.receive(Buffer.from("11", "ascii"));
                    port._client.receive(Buffer.from("03", "ascii"));
                    port._client.receive(Buffer.from("06", "ascii"));
                    port._client.receive(Buffer.from("AE", "ascii"));
                    port._client.receive(Buffer.from("41", "ascii"));
                    port._client.receive(Buffer.from("56", "ascii"));
                    port._client.receive(Buffer.from("52", "ascii"));
                    port._client.receive(Buffer.from("43", "ascii"));
                    port._client.receive(Buffer.from("40", "ascii"));
                    port._client.receive(Buffer.from("CC", "ascii"));
                    port._client.receive(Buffer.from("\r\n", "ascii"));
                });
            });
        });

        it("Illegal end chars, should return a valid Modbus ASCII message", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("110306ae415652434049ad");
                done();
            });
            port.open(function() {
                port.write(Buffer.from("1103006B00037687", "hex"));
                setTimeout(function() {
                    port._client.receive(Buffer.from(">", "ascii"));
                    port._client.receive(Buffer.from("11", "ascii"));
                    port._client.receive(Buffer.from("03", "ascii"));
                    port._client.receive(Buffer.from("06", "ascii"));
                    port._client.receive(Buffer.from("AE", "ascii"));
                    port._client.receive(Buffer.from("41", "ascii"));
                    port._client.receive(Buffer.from("56", "ascii"));
                    port._client.receive(Buffer.from("52", "ascii"));
                    port._client.receive(Buffer.from("43", "ascii"));
                    port._client.receive(Buffer.from("40", "ascii"));
                    port._client.receive(Buffer.from("CC", "ascii"));
                    port._client.receive(Buffer.from("\r\n", "ascii"));
                    port._client.receive(Buffer.from("20", "ascii")); // illegal char
                    port._client.receive(Buffer.from("54", "ascii")); // illegal char
                    port._client.receive(Buffer.from("54", "ascii")); // illegal char
                    port._client.receive(Buffer.from("FF", "ascii")); // illegal char
                });
            });
        });

        it("should return a valid Modbus ASCII message on illegal chars", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("110306ae415652434049ad");
                done();
            });
            port.open(function() {
                port.write(Buffer.from("1103006B00037687", "hex"));
                setTimeout(function() {
                    port._client.receive(Buffer.from(">", "ascii"));
                    port._client.receive(Buffer.from("11", "ascii"));
                    port._client.receive(Buffer.from("03", "ascii"));
                    port._client.receive(Buffer.from("06", "ascii"));
                    port._client.receive(Buffer.from("AE", "ascii"));
                    port._client.receive(Buffer.from("41", "ascii"));
                    port._client.receive(Buffer.from("56", "ascii"));
                    port._client.receive(Buffer.from("52", "ascii"));
                    port._client.receive(Buffer.from("43", "ascii"));
                    port._client.receive(Buffer.from("40", "ascii"));
                    port._client.receive(Buffer.from("CC", "ascii"));
                    port._client.receive(Buffer.from("\r\n", "ascii"));
                });
            });
        });
    });

    describe("#write", function() {
        it("should write a valid Modbus ASCII message to the port", function() {
            port.write(Buffer.from("1103006B00037687", "hex"));
            expect(port._client._data.toString("ascii")).to.equal(":1103006B00037E\r\n");
        });
    });
});
