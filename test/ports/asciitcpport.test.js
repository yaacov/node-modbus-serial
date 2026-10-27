"use strict";

const expect = require("chai").expect;
const mockery = require("mockery");

const LONG_MSG = "010380018301830183018301830183018301830183018301830183018301830\
1830183018301830183018301830183018301830183018301830183018301830183018301830183\
0183018301830183018301830183018301830183018301830183018301830183018301830183018\
3018301830183018301830183018301830183018346e0";

describe("Modbus Ascii TCP port", function() {
    let port;
    let AsciiTcpPort;

    before(function() {
        const mock = require("./../mocks/netMock");
        mockery.resetCache();
        mockery.enable({ warnOnReplace: false, useCleanCache: true, warnOnUnregistered: false });
        mockery.registerMock("net", mock);
        AsciiTcpPort = require("./../../ports/asciitcpport");
    });

    after(function() {
        mockery.disable();
    });

    beforeEach(function() {
        port = new AsciiTcpPort("127.0.0.1", { port: 9999 });
    });

    afterEach(function() {
        port.close();
    });

    describe("constructor", function() {
        it("should use port 502 by default", function() {
            const p = new AsciiTcpPort("127.0.0.1");
            expect(p.connectOptions.host).to.equal("127.0.0.1");
            expect(p.connectOptions.port).to.equal(502);
        });

        it("should accept options as first argument", function() {
            const p = new AsciiTcpPort({ ip: "10.0.0.1", port: 4001 });
            expect(p.connectOptions.host).to.equal("10.0.0.1");
            expect(p.connectOptions.port).to.equal(4001);
        });

        it("should throw on an invalid socket", function() {
            expect(function() {
                new AsciiTcpPort({ socket: {} });
            }).to.throw("invalid socket provided");
        });
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
    });

    describe("data handler", function() {
        it("should return a valid Modbus ASCII message received in one chunk", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("110306ae415652434049ad");
                done();
            });
            port.open(function() {
                port.write(Buffer.from("1103006B00037687", "hex"));
                setTimeout(function() {
                    port._client.receive(Buffer.from(":110306AE4156524340CC\r\n", "ascii"));
                });
            });
        });

        it("should return a valid Modbus ASCII message received in fragments", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("110306ae415652434049ad");
                done();
            });
            port.open(function() {
                port.write(Buffer.from("1103006B00037687", "hex"));
                setTimeout(function() {
                    port._client.receive(Buffer.from(":1103", "ascii"));
                    port._client.receive(Buffer.from("06AE4156", "ascii"));
                    port._client.receive(Buffer.from("524340CC\r", "ascii"));
                    port._client.receive(Buffer.from("\n", "ascii"));
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
                    port._client.receive(Buffer.from(":11830468\r\n", "ascii"));
                });
            });
        });

        it("should return a long Modbus ASCII message", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal(LONG_MSG);
                done();
            });
            port.open(function() {
                port.write(Buffer.from("010300000040443A", "hex"));
                setTimeout(function() {
                    const payload = LONG_MSG.slice(0, -4).toUpperCase();
                    port._client.receive(Buffer.from(":" + payload + "7C\r\n", "ascii"));
                });
            });
        });

        it("should skip leading garbage and use a custom start char", function(done) {
            const p = new AsciiTcpPort("127.0.0.1", { startOfSlaveFrameChar: 0x3E });
            p.once("data", function(data) {
                expect(data.toString("hex")).to.equal("110306ae415652434049ad");
                p.close();
                done();
            });
            p.open(function() {
                p.write(Buffer.from("1103006B00037687", "hex"));
                setTimeout(function() {
                    p._client.receive(Buffer.from(" TT\xff>110306AE4156524340CC\r\n", "ascii"));
                });
            });
        });

        it("should not emit on LRC error", function(done) {
            port.once("data", function() {
                done(new Error("should not emit data"));
            });
            port.open(function() {
                port.write(Buffer.from("1103006B00037687", "hex"));
                setTimeout(function() {
                    port._client.receive(Buffer.from(":110306AE41565243400C\r\n", "ascii"));
                    setTimeout(done, 10);
                });
            });
        });

        it("should not emit an answer from another unit", function(done) {
            port.once("data", function() {
                done(new Error("should not emit data"));
            });
            port.open(function() {
                port.write(Buffer.from("1103006B00037687", "hex"));
                setTimeout(function() {
                    // valid frame for unit 0x12
                    port._client.receive(Buffer.from(":120306AE4156524340CB\r\n", "ascii"));
                    setTimeout(done, 10);
                });
            });
        });
    });

    describe("#write", function() {
        it("should write a valid Modbus ASCII message to the socket", function() {
            port.write(Buffer.from("1103006B00037687", "hex"));
            expect(port._client._data.toString("ascii")).to.equal(":1103006B00037E\r\n");
        });
    });
});

describe("ModbusRTU connectAsciiTCP", function() {
    let ModbusRTU;

    before(function() {
        const mock = require("./../mocks/netMock");
        mockery.resetCache();
        mockery.enable({ warnOnReplace: false, useCleanCache: true, warnOnUnregistered: false });
        mockery.registerMock("net", mock);
        ModbusRTU = require("./../../index");
    });

    after(function() {
        mockery.disable();
    });

    it("should read holding registers over an ASCII TCP connection", function() {
        const client = new ModbusRTU();

        return client.connectAsciiTCP("127.0.0.1", { port: 9999 })
            .then(function() {
                expect(client.isOpen).to.be.true;
                client.setID(0x11);

                const p = client.readHoldingRegisters(0x6B, 3);
                expect(client._port._client._data.toString("ascii")).to.equal(":1103006B00037E\r\n");
                client._port._client.receive(Buffer.from(":110306AE4156524340CC\r\n", "ascii"));
                return p;
            })
            .then(function(result) {
                expect(result.data).to.deep.equal([0xAE41, 0x5652, 0x4340]);
                client.close();
            });
    });
});