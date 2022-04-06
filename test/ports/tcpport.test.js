"use strict";
/* eslint-disable no-undef */

const expect = require("chai").expect;
const mockery = require("mockery");

describe("Modbus TCP port", function() {
    let port;

    before(function() {
        const mock = require("./../mocks/netMock");
        mockery.resetCache();
        mockery.enable({ warnOnReplace: false, useCleanCache: true, warnOnUnregistered: false });
        mockery.registerMock("net", mock);
        const TcpPort = require("./../../ports/tcpport");
        port = new TcpPort("127.0.0.1", { port: 9999 });
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
                    setTimeout(function() {
                        expect(port.isOpen).to.be.false;
                        done();
                    });
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
    });

    describe("data handler", function() {
        it("should return a valid Modbus TCP message", function(done) {
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

        it("should return a valid Modbus TCP exception", function(done) {
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
        it("should write a valid TCP message to the port", function() {
            port.write(Buffer.from("1103006B00037687", "hex"));
            expect(port._client._data.toString("hex")).to.equal("0003000000061103006b0003");
        });
    });

});
