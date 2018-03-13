"use strict";
/* eslint-disable no-undef */

var expect = require("chai").expect;
var mockery = require("mockery");

var LONG_MSG = "010380018301830183018301830183018301830183018301830183018301830\
1830183018301830183018301830183018301830183018301830183018301830183018301830183\
0183018301830183018301830183018301830183018301830183018301830183018301830183018\
3018301830183018301830183018301830183018346e0";

describe("Modbus Telnet port", function() {
    var port;

    before(function() {
        var mock = require("./../mocks/netMock");
        mockery.resetCache();
        mockery.enable({ warnOnReplace: false, useCleanCache: true, warnOnUnregistered: false });
        mockery.registerMock("net", mock);
        var TelnetPort = require("./../../ports/telnetport");
        port = new TelnetPort("127.0.0.1", { port: 9999 });
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
        it("should be able to be destoryed after opening", function(done) {
            port.open(function() {
                port.destroy(function() {
                    setTimeout(function() {
                        expect(port.isOpen).to.be.false;
                        done();
                    });
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
                port.write(new Buffer("1103006B00037687", "hex"));
                setTimeout(function() {
                    port._client.receive(new Buffer("11", "hex"));
                    port._client.receive(new Buffer("03", "hex"));
                    port._client.receive(new Buffer("06", "hex"));
                    port._client.receive(new Buffer("ae", "hex"));
                    port._client.receive(new Buffer("41", "hex"));
                    port._client.receive(new Buffer("56", "hex"));
                    port._client.receive(new Buffer("52", "hex"));
                    port._client.receive(new Buffer("43", "hex"));
                    port._client.receive(new Buffer("40", "hex"));
                    port._client.receive(new Buffer("49", "hex"));
                    port._client.receive(new Buffer("ad", "hex"));
                });
            });
        });

        it("should return a valid Modbus RTU exception", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("1183044136");
                done();
            });
            port.open(function() {
                port.write(new Buffer("1103006B00037687", "hex"));
                setTimeout(function() {
                    port._client.receive(new Buffer("11", "hex"));
                    port._client.receive(new Buffer("83", "hex"));
                    port._client.receive(new Buffer("04", "hex"));
                    port._client.receive(new Buffer("41", "hex"));
                    port._client.receive(new Buffer("36", "hex"));
                });
            });
        });

        it("Special data package, should return a valid Modbus RTU message", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal(LONG_MSG);
                done();
            });
            port.open(function() {
                port.write(new Buffer("010300000040443A", "hex"));
                setTimeout(function() {
                    for (var i = 0; i < LONG_MSG.length; i += 2) {
                        port._client.receive(new Buffer(LONG_MSG.slice(i, i + 2), "hex"));
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
                port.write(new Buffer("1103006B00037687", "hex"));
                setTimeout(function() {
                    port._client.receive(new Buffer("20", "hex")); // illegal char
                    port._client.receive(new Buffer("54", "hex")); // illegal char
                    port._client.receive(new Buffer("54", "hex")); // illegal char
                    port._client.receive(new Buffer("ff", "hex")); // illegal char
                    port._client.receive(new Buffer("11", "hex"));
                    port._client.receive(new Buffer("03", "hex"));
                    port._client.receive(new Buffer("06", "hex"));
                    port._client.receive(new Buffer("ae", "hex"));
                    port._client.receive(new Buffer("41", "hex"));
                    port._client.receive(new Buffer("56", "hex"));
                    port._client.receive(new Buffer("52", "hex"));
                    port._client.receive(new Buffer("43", "hex"));
                    port._client.receive(new Buffer("40", "hex"));
                    port._client.receive(new Buffer("49", "hex"));
                    port._client.receive(new Buffer("ad", "hex"));
                });
            });
        });
        it("Illegal end chars, should return a valid Modbus RTU message", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("110306ae415652434049ad");
                done();
            });
            port.open(function() {
                port.write(new Buffer("1103006B00037687", "hex"));
                setTimeout(function() {
                    port._client.receive(new Buffer("11", "hex"));
                    port._client.receive(new Buffer("03", "hex"));
                    port._client.receive(new Buffer("06", "hex"));
                    port._client.receive(new Buffer("ae", "hex"));
                    port._client.receive(new Buffer("41", "hex"));
                    port._client.receive(new Buffer("56", "hex"));
                    port._client.receive(new Buffer("52", "hex"));
                    port._client.receive(new Buffer("43", "hex"));
                    port._client.receive(new Buffer("40", "hex"));
                    port._client.receive(new Buffer("49", "hex"));
                    port._client.receive(new Buffer("ad", "hex"));
                    port._client.receive(new Buffer("20", "hex")); // illegal char
                    port._client.receive(new Buffer("54", "hex")); // illegal char
                    port._client.receive(new Buffer("54", "hex")); // illegal char
                    port._client.receive(new Buffer("ff", "hex")); // illegal char
                });
            });
        });

        it("should return a valid Modbus RTU message on illegal chars", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("110306ae415652434049ad");
                done();
            });
            port.open(function() {
                port.write(new Buffer("1103006B00037687", "hex"));
                setTimeout(function() {
                    port._client.receive(new Buffer("11", "hex"));
                    port._client.receive(new Buffer("03", "hex"));
                    port._client.receive(new Buffer("06", "hex"));
                    port._client.receive(new Buffer("ae", "hex"));
                    port._client.receive(new Buffer("41", "hex"));
                    port._client.receive(new Buffer("56", "hex"));
                    port._client.receive(new Buffer("52", "hex"));
                    port._client.receive(new Buffer("43", "hex"));
                    port._client.receive(new Buffer("40", "hex"));
                    port._client.receive(new Buffer("49", "hex"));
                    port._client.receive(new Buffer("ad", "hex"));
                });
            });
        });
    });

    describe("#write", function() {
        it("should write a valid RTU message to the port", function() {
            port.write(new Buffer("1103006B00037687", "hex"));
            expect(port._client._data.toString("hex")).to.equal("1103006b00037687");
        });
    });
});
