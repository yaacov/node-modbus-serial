"use strict";

const expect = require("chai").expect;
const mockery = require("mockery");

describe("Modbus TCP port methods", function() {
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

    describe("Modbus TCP port constructor", function() {
        const TcpPort = require("./../../ports/tcpport");
        it("with ip as string", function() {
            const port = new TcpPort("localhost");

            expect(port).to.be.an.instanceOf(TcpPort);
            expect(port.connectOptions.host).to.equal("localhost");
            expect(port.connectOptions.port).to.equal(502);
        });

        it("with ip as object", function() {
            const port = new TcpPort({ ip: "localhost" });

            expect(port).to.be.an.instanceOf(TcpPort);
            expect(port.connectOptions.host).to.equal("localhost");
            expect(port.connectOptions.port).to.equal(502);
        });

        it("with ip as object and port as number", function() {
            const port = new TcpPort({ ip: "localhost", port: 9999 });

            expect(port).to.be.an.instanceOf(TcpPort);
            expect(port.connectOptions.host).to.equal("localhost");
            expect(port.connectOptions.port).to.equal(9999);
        });

        it("with ip as string and options as object", function() {
            const port = new TcpPort("localhost", { port: 9999 });

            expect(port).to.be.an.instanceOf(TcpPort);
            expect(port.connectOptions.host).to.equal("localhost");
            expect(port.connectOptions.port).to.equal(9999);
        });

        it("with socket creation options", function() {
            const controller = new AbortController();
            const port = new TcpPort("localhost", { port: 9999,
                socketOpts: {
                    allowHalfOpen: true,
                    readable: true,
                    writable: true,
                    signal: controller.signal
                } });

            expect(port).to.be.an.instanceOf(TcpPort);
            expect(port.connectOptions.host).to.equal("localhost");
            expect(port.connectOptions.port).to.equal(9999);
            expect(port.socketOpts).to.deep.equal({
                allowHalfOpen: true,
                readable: true,
                writable: true,
                signal: controller.signal
            });
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
                port._writeCompleted.then(function() {
                    if (port._client._data.equals(Buffer.from("0001000000061103006B0003", "hex"))) {
                        port._client.receive(Buffer.from("000100000006110366778899", "hex"));
                    }
                });
            });
        });

        it("should return a valid Modbus TCP exception", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("1183044136");
                done();
            });
            port.open(function() {
                port.write(Buffer.from("1103006B00037687", "hex"));
                port._writeCompleted.then(function() {
                    if (port._client._data.equals(Buffer.from("0002000000061103006B0003", "hex"))) {
                        port._client.receive(Buffer.from("000200000003118304", "hex"));
                    }
                });
            });
        });
    });

    describe("#write", function() {
        it("should write a valid TCP message to the port", function(done) {
            port.write(Buffer.from("1103006B00037687", "hex"));
            port._writeCompleted.then(function() {
                expect(port._client._data.toString("hex")).to.equal("0003000000061103006b0003");
                done();
            });
        });
    });

    describe("socket errors", function() {
        let TcpPort;

        beforeEach(function() {
            // require here, not at describe time, so it gets the mocked net registered in before()
            TcpPort = require("./../../ports/tcpport");
        });

        it("should emit close when an open connection errors", function(done) {
            const errPort = new TcpPort("127.0.0.1", { port: 9999 });
            let closes = 0;
            errPort.on("close", function() {
                closes++;
            });
            errPort.open(function() {
                // after open() has finished with its callback
                setImmediate(function() {
                    // like ECONNRESET: net.Socket emits 'error', then 'close' with had_error
                    errPort._client.emit("error", new Error("read ECONNRESET"));
                    expect(errPort.isOpen).to.be.false;
                    errPort._client.emit("close", true);
                    expect(closes).to.equal(1);
                    done();
                });
            });
        });

        it("should not emit close when the connection attempt fails", function() {
            const errPort = new TcpPort("127.0.0.1", { port: 9999 });
            let closes = 0;
            errPort.on("close", function() {
                closes++;
            });
            // like ECONNREFUSED: the socket never connects, then emits 'error' and 'close'
            errPort._client.emit("error", new Error("connect ECONNREFUSED"));
            errPort._client.emit("close", true);
            expect(closes).to.equal(0);
        });
    });
});
