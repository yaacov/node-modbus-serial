"use strict";
/* eslint-disable no-undef */

var expect = require("chai").expect;
var mockery = require("mockery");

describe("Modbus TCP RTU buffered port", function() {
    var port;

    before(function() {
        var mock = require("./../mocks/netMock");
        mockery.resetCache();
        mockery.enable({ warnOnReplace: false, useCleanCache: true, warnOnUnregistered: false });
        mockery.registerMock("net", mock);
        var TcpRTUBufferedPort = require("./../../ports/tcprtubufferedport");
        port = new TcpRTUBufferedPort("127.0.0.1", { port: 9999, removeCRC: true });
    });

    after(function() {
        mockery.disable();
    });

    afterEach(function() {
        port.close();
    });

    describe("#isOpen", function() {
        it("should not be open before #open", function() {
            expect(port.isOpen()).to.be.false;
        });

        it("should be open after #open", function(done) {
            port.open(function() {
                expect(port.isOpen()).to.be.true;
                done();
            });
        });

        it("should not be open after #close", function(done) {
            port.open(function() {
                port.close(function() {
                    expect(port.isOpen()).to.be.false;
                    done();
                });
            });
        });
    });

    describe("data handler", function() {
        it("should return a valid Modbus TCP message at once", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("01030802070207020702072637");
                done();
            });
            port.open(function() {
                port.write(new Buffer("0103000500045408", "hex"));
                setTimeout(function() {
                    port._client.receive(new Buffer("00010000000b0103080207020702070207", "hex"));
                });
            });
        });

        it("should return a valid Modbus TCP RTU message", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("01030802070207020702072637");
                done();
            });
            port.open(function() {
                port.write(new Buffer("0103000500045408", "hex"));
                setTimeout(function() {
                    port._client.receive(new Buffer("00010000000b010308", "hex"));
                    port._client.receive(new Buffer("00010000000b0207020702070207", "hex"));
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
                    port._client.receive(new Buffer("00000000000611", "hex"));
                    port._client.receive(new Buffer("00000000000683", "hex"));
                    port._client.receive(new Buffer("00000000000604", "hex"));
                    port._client.receive(new Buffer("00000000000641", "hex"));
                    port._client.receive(new Buffer("00000000000636", "hex"));
                });
            });
        });

        it("Illegal start chars, should synchronize to valid Modbus TCP RTU message", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("110306ae415652434049ad");
                done();
            });
            port.open(function() {
                port.write(new Buffer("1103006B00037687", "hex"));
                setTimeout(function() {
                    port._client.receive(new Buffer("00000000000620", "hex")); // illegal char
                    port._client.receive(new Buffer("00000000000654", "hex")); // illegal char
                    port._client.receive(new Buffer("00000000000654", "hex")); // illegal char
                    port._client.receive(new Buffer("000000000006ff", "hex")); // illegal char
                    port._client.receive(new Buffer("00000000000611", "hex"));
                    port._client.receive(new Buffer("00000000000603", "hex"));
                    port._client.receive(new Buffer("00000000000606", "hex"));
                    port._client.receive(new Buffer("000000000006ae", "hex"));
                    port._client.receive(new Buffer("00000000000641", "hex"));
                    port._client.receive(new Buffer("00000000000656", "hex"));
                    port._client.receive(new Buffer("00000000000652", "hex"));
                    port._client.receive(new Buffer("00000000000643", "hex"));
                    port._client.receive(new Buffer("00000000000640", "hex"));
                    port._client.receive(new Buffer("00000000000649", "hex"));
                    port._client.receive(new Buffer("000000000006ad", "hex"));
                });
            });
        });

        it("Illegal end chars, should return a valid Modbus TCP RTU message", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("110306ae415652434049ad");
                done();
            });
            port.open(function() {
                port.write(new Buffer("1103006B00037687", "hex"));
                setTimeout(function() {
                    port._client.receive(new Buffer("00000000000611", "hex"));
                    port._client.receive(new Buffer("00000000000603", "hex"));
                    port._client.receive(new Buffer("00000000000606", "hex"));
                    port._client.receive(new Buffer("000000000006ae", "hex"));
                    port._client.receive(new Buffer("00000000000641", "hex"));
                    port._client.receive(new Buffer("00000000000656", "hex"));
                    port._client.receive(new Buffer("00000000000652", "hex"));
                    port._client.receive(new Buffer("00000000000643", "hex"));
                    port._client.receive(new Buffer("00000000000640", "hex"));
                    port._client.receive(new Buffer("00000000000649", "hex"));
                    port._client.receive(new Buffer("000000000006ad", "hex"));
                    port._client.receive(new Buffer("00000000000620", "hex")); // illegal char
                    port._client.receive(new Buffer("00000000000654", "hex")); // illegal char
                    port._client.receive(new Buffer("00000000000654", "hex")); // illegal char
                    port._client.receive(new Buffer("000000000006ff", "hex")); // illegal char
                });
            });
        });

        it("should return a valid Modbus TCP RTU message on illegal chars", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("110306ae415652434049ad");
                done();
            });
            port.open(function() {
                port.write(new Buffer("1103006B00037687", "hex"));
                setTimeout(function() {
                    port._client.receive(new Buffer("00000000000611", "hex"));
                    port._client.receive(new Buffer("00000000000603", "hex"));
                    port._client.receive(new Buffer("00000000000606", "hex"));
                    port._client.receive(new Buffer("000000000006ae", "hex"));
                    port._client.receive(new Buffer("00000000000641", "hex"));
                    port._client.receive(new Buffer("00000000000656", "hex"));
                    port._client.receive(new Buffer("00000000000652", "hex"));
                    port._client.receive(new Buffer("00000000000643", "hex"));
                    port._client.receive(new Buffer("00000000000640", "hex"));
                    port._client.receive(new Buffer("00000000000649", "hex"));
                    port._client.receive(new Buffer("000000000006ad", "hex"));
                });
            });
        });
    });

    describe("#write", function() {
        it("should write a valid TCP RTU message to the port", function() {
            port.write(new Buffer("0103000500045408", "hex"));
            expect(port._client._data.toString("hex")).to.equal("000400000006010300050004");
        });
    });
});
