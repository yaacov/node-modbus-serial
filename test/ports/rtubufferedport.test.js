"use strict";
/* eslint-disable no-undef */

const expect = require("chai").expect;
const mockery = require("mockery");

const LONG_MSG = "010380018301830183018301830183018301830183018301830183018301830\
1830183018301830183018301830183018301830183018301830183018301830183018301830183\
0183018301830183018301830183018301830183018301830183018301830183018301830183018\
3018301830183018301830183018301830183018346e0";

describe("Modbus RTU buffered port", function() {
    let port;

    before(function() {
        const mock = require("./../mocks/SerialPortMock");
        mockery.resetCache();
        mockery.enable({ warnOnReplace: false, useCleanCache: true, warnOnUnregistered: false });
        mockery.registerMock("serialport", mock);
        const RTUBufferedPort = require("./../../ports/rtubufferedport");
        port = new RTUBufferedPort("/dev/null", {});
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
        it("should return a valid Modbus RTU message", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("110306ae415652434049ad");
                done();
            });
            port.open(function() {
                port.write(Buffer.from("1103006B00037687", "hex"));
                setTimeout(function() {
                    port._client.receive(Buffer.from("11", "hex"));
                    port._client.receive(Buffer.from("03", "hex"));
                    port._client.receive(Buffer.from("06", "hex"));
                    port._client.receive(Buffer.from("ae", "hex"));
                    port._client.receive(Buffer.from("41", "hex"));
                    port._client.receive(Buffer.from("56", "hex"));
                    port._client.receive(Buffer.from("52", "hex"));
                    port._client.receive(Buffer.from("43", "hex"));
                    port._client.receive(Buffer.from("40", "hex"));
                    port._client.receive(Buffer.from("49", "hex"));
                    port._client.receive(Buffer.from("ad", "hex"));
                });
            });
        });

        it("should return a valid Modbus RTU exception", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("1183044136");
                done();
            });
            port.open(function() {
                port.write(Buffer.from("1103006B00037687", "hex"));
                setTimeout(function() {
                    port._client.receive(Buffer.from("11", "hex"));
                    port._client.receive(Buffer.from("83", "hex"));
                    port._client.receive(Buffer.from("04", "hex"));
                    port._client.receive(Buffer.from("41", "hex"));
                    port._client.receive(Buffer.from("36", "hex"));
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
                    for (let i = 0; i < LONG_MSG.length; i += 2) {
                        port._client.receive(Buffer.from(LONG_MSG.slice(i, i + 2), "hex"));
                    }
                });
            });
        });

        it("Illegal start chars, should synchronize to valid Modbus RTU message", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("110306ae415652434049ad");
                done();
            });
            port.open(function() {
                port.write(Buffer.from("1103006B00037687", "hex"));
                setTimeout(function() {
                    port._client.receive(Buffer.from("20", "hex")); // illegal char
                    port._client.receive(Buffer.from("54", "hex")); // illegal char
                    port._client.receive(Buffer.from("54", "hex")); // illegal char
                    port._client.receive(Buffer.from("ff", "hex")); // illegal char
                    port._client.receive(Buffer.from("11", "hex"));
                    port._client.receive(Buffer.from("03", "hex"));
                    port._client.receive(Buffer.from("06", "hex"));
                    port._client.receive(Buffer.from("ae", "hex"));
                    port._client.receive(Buffer.from("41", "hex"));
                    port._client.receive(Buffer.from("56", "hex"));
                    port._client.receive(Buffer.from("52", "hex"));
                    port._client.receive(Buffer.from("43", "hex"));
                    port._client.receive(Buffer.from("40", "hex"));
                    port._client.receive(Buffer.from("49", "hex"));
                    port._client.receive(Buffer.from("ad", "hex"));
                });
            });
        });

        it("Illegal end chars, should return a valid Modbus RTU message", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("110306ae415652434049ad");
                done();
            });
            port.open(function() {
                port.write(Buffer.from("1103006B00037687", "hex"));
                setTimeout(function() {
                    port._client.receive(Buffer.from("11", "hex"));
                    port._client.receive(Buffer.from("03", "hex"));
                    port._client.receive(Buffer.from("06", "hex"));
                    port._client.receive(Buffer.from("ae", "hex"));
                    port._client.receive(Buffer.from("41", "hex"));
                    port._client.receive(Buffer.from("56", "hex"));
                    port._client.receive(Buffer.from("52", "hex"));
                    port._client.receive(Buffer.from("43", "hex"));
                    port._client.receive(Buffer.from("40", "hex"));
                    port._client.receive(Buffer.from("49", "hex"));
                    port._client.receive(Buffer.from("ad", "hex"));
                    port._client.receive(Buffer.from("20", "hex")); // illegal char
                    port._client.receive(Buffer.from("54", "hex")); // illegal char
                    port._client.receive(Buffer.from("54", "hex")); // illegal char
                    port._client.receive(Buffer.from("ff", "hex")); // illegal char
                });
            });
        });

        it("should return a valid Modbus RTU message on illegal chars", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("110306ae415652434049ad");
                done();
            });
            port.open(function() {
                port.write(Buffer.from("1103006B00037687", "hex"));
                setTimeout(function() {
                    port._client.receive(Buffer.from("11", "hex"));
                    port._client.receive(Buffer.from("03", "hex"));
                    port._client.receive(Buffer.from("06", "hex"));
                    port._client.receive(Buffer.from("ae", "hex"));
                    port._client.receive(Buffer.from("41", "hex"));
                    port._client.receive(Buffer.from("56", "hex"));
                    port._client.receive(Buffer.from("52", "hex"));
                    port._client.receive(Buffer.from("43", "hex"));
                    port._client.receive(Buffer.from("40", "hex"));
                    port._client.receive(Buffer.from("49", "hex"));
                    port._client.receive(Buffer.from("ad", "hex"));
                });
            });
        });
    });

    describe("#write", function() {
        it("should write a valid RTU message to the port", function() {
            port.write(Buffer.from("1103006B00037687", "hex"));
            expect(port._client._data.toString("hex")).to.equal("1103006b00037687");
        });
    });
});
