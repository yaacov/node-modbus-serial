"use strict";
/* eslint-disable no-undef */

var expect = require("chai").expect;
var mockery = require("mockery");

describe("Modbus TCP RTU buffered port", function() {
    var port;

    function send(buffers) {
        port.open(function() {
            setTimeout(function() {
                buffers.forEach(function(buffer) { port._client.receive(buffer); });
                port.close();
            });
        });
    }

    before(function() {
        var mock = require("./../mocks/netMock");
        mockery.resetCache();
        mockery.enable({ warnOnReplace: false, useCleanCache: true, warnOnUnregistered: false });
        mockery.registerMock("net", mock);
        var TcpRTUBufferedPort = require("./../../ports/tcprtubufferedport");
        port = new TcpRTUBufferedPort("127.0.0.1", { port: 9999 });
    });

    after(function() {
        mockery.disable();
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
        it("should be able to be destroyed after opening", function(done) {
            port.open(function() {
                port.destroy(function() {
                    setTimeout(function() {
                        expect(port.isOpen).to.be.false;
                        done();
                    });
                });
            });
        });
        it("should not be closed on timeout", function(done) {
            port.open(function() {
                expect(port.isOpen).to.be.true;
                port.emit("timeout");
                expect(port.isOpen).to.be.true;
                done();
            });
        });
    });

    describe("data handler", function() {
        it("should return a valid Modbus TCP message at once", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("1103667788994fa2");
                done();
            });
            send([Buffer.from("000100000006110366778899", "hex")]);
        });

        it("should return a valid Modbus TCP RTU message", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("1103667788994fa2");
                done();
            });
            send([
                Buffer.from("0002000000", "hex"),
                Buffer.from("0611036677", "hex"),
                Buffer.from("8899", "hex")
            ]);
        });

        it("should return a valid Modbus TCP exception", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("1183044136");
                done();
            });
            send([Buffer.from("000300000003118304", "hex")]);
        });

        it("Illegal start chars, should synchronize to valid Modbus TCP RTU message", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("1103667788994fa2");
                done();
            });
            send([Buffer.from("3456000400000006110366778899", "hex")]);
        });

        it("Illegal end chars, should return a valid Modbus TCP RTU message", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("1103667788994fa2");
                done();
            });
            send([Buffer.from("0005000000061103667788993456", "hex")]);
        });
    });

    describe("#write", function() {
        it("should write a valid TCP RTU message to the port", function() {
            port.write(Buffer.from("0103000500045408", "hex"));
            expect(port._client._data.toString("hex")).to.equal("000100000006010300050004");
        });
    });
});
