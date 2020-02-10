"use strict";
/* eslint-disable no-undef */

var expect = require("chai").expect;
var mockery = require("mockery");

describe("Modbus UDP port", function() {
    var port;

    before(function() {
        var mock = require("../mocks/dgramMock");
        mockery.resetCache();
        mockery.enable({ warnOnReplace: false, useCleanCache: true, warnOnUnregistered: false });
        mockery.registerMock("dgram", mock);
        var UdpPort = require("../../ports/udpport");
        port = new UdpPort("127.0.0.1", { port: 9999 });
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

        it("should be open after onListening", function(done) {
            port._client.listen();
            setTimeout(function() {
                expect(port.isOpen).to.be.true;
                done();
            });
        });

        it("should not be open after #close", function(done) {
            port._client.listen();
            setTimeout(function() {
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
                expect(data.toString("hex")).to.equal("1103667788994fa2");
                done();
            });
            port.open(function() {
                port.write(Buffer.from("1103006B00037687", "hex"));

                if (port._client._data.equals(Buffer.from("0001000000061103006B0003", "hex"))) {
                    port._client.receive(Buffer.from("000100000006110366778899", "hex"));
                }
            });
        });

        it("should return a valid Modbus RTU exception", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("1183044136");
                done();
            });
            port.open(function() {
                port.write(Buffer.from("1103006B00037687", "hex"));

                if (port._client._data.equals(Buffer.from("0002000000061103006B0003", "hex"))) {
                    port._client.receive(Buffer.from("000200000003118304", "hex"));
                }
            });
        });
    });

    describe("#write", function() {
        it("should write a valid message to the port", function() {
            port.write(Buffer.from("1103006B00037687", "hex"));
            expect(port._client._data.toString("hex")).to.equal("0003000000061103006b0003");
        });
    });

});
