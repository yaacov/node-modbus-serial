"use strict";

const expect = require("chai").expect;
const net = require("net");
const TcpServer = require("./../../servers/servertcp");

describe("Modbus TCP Server Promise", function() {
    let serverTCP;
    let maskedRegister;

    before(function() {
        maskedRegister = 0xffff;
        const vector = {
            getInputRegister: function(addr) {
                return new Promise(function(resolve) {
                    setTimeout(function() {
                        resolve(addr);
                    }, 50);
                });
            },
            getHoldingRegister: function(addr) {
                return new Promise(function(resolve, reject) {
                    setTimeout(function() {
                        if (addr === 62)
                            return reject(new Error());

                        resolve(addr + 8000);
                    }, 50);
                });
            },
            getCoil: function(addr) {
                return new Promise(function(resolve) {
                    setTimeout(function() {
                        resolve((addr % 2) === 0);
                    }, 50);
                });
            },
            setRegister: function(addr, value) {
                return new Promise(function(resolve) {
                    setTimeout(function() {
                        console.log("\tset register", addr, value);
                        resolve();
                    }, 50);
                });
            },
            setRegisterMask: function(addr, andMask, orMask) {
                return new Promise(function(resolve, reject) {
                    setTimeout(function() {
                        if (addr === 62) {
                            reject(new Error());
                            return;
                        }

                        maskedRegister = (maskedRegister & andMask) | (orMask & ~andMask);
                        resolve();
                    }, 50);
                });
            },
            setCoil: function(addr, value) {
                return new Promise(function(resolve) {
                    setTimeout(function() {
                        console.log("\tset coil", addr, value);
                        resolve();
                    }, 50);
                });
            }
        };
        serverTCP = new TcpServer(vector, { host: "0.0.0.0", port: 8514, debug: true, unitID: 1 });
    });

    after(function() {
        serverTCP.close();
    });

    describe("function code handler", function() {
        it("should receive a valid Modbus TCP message", function(done) {
            const client = net.connect({ host: "0.0.0.0", port: 8514 }, function() {
                // FC05 - force single coil, to on 0xff00
                client.write(Buffer.from("00010000000601050005ff00", "hex"));
            });

            client.once("data", function(data) {
                // FC05 - valid response
                expect(data.toString("hex")).to.equal("00010000000601050005ff00");
                done();
            });
        });

        it("should mask a holding register with FC22", function(done) {
            const client = net.connect({ host: "0.0.0.0", port: 8514 }, function() {
                client.write(Buffer.from("0001000000080116000900f0000f", "hex"));
            });

            client.once("data", function(data) {
                expect(data.toString("hex")).to.equal("0001000000080116000900f0000f");
                expect(maskedRegister).to.equal(0x00ff);

                client.end();
                done();
            });
        });

        // TODO: FC1 - FCX tests
    });

    describe("modbus exception handler", function() {
        it("should receive a valid Modbus TCP message", function(done) {
            const client = net.connect({ host: "0.0.0.0", port: 8514 }, function() {
                // FC07 - unhandled function
                client.write(Buffer.from("000100000006010700000000", "hex"));
            });

            client.once("data", function(data) {
                // A valid error message, code 0x01 - Illegal function
                expect(data.toString("hex")).to.equal("000100000003018701");
                done();
            });
        });

        it("should receive a valid slave failure Modbus TCP message", function(done) {
            const client = net.connect({ host: "0.0.0.0", port: 8514 }, function() {
                // FC03 to error triggering address
                client.write(Buffer.from("0001000000060103003E0001", "hex"));
            });

            client.once("data", function(data) {
                // A valid error message, code 0x04 - Slave failure
                expect(data.toString("hex")).to.equal("000100000003018304");
                done();
            });
        });

        it("should receive a slave failure when a FC22 Promise rejects", function(done) {
            const client = net.connect({ host: "0.0.0.0", port: 8514 }, function() {
                client.write(Buffer.from("0001000000080116003E00f0000f", "hex"));
            });

            client.once("data", function(data) {
                expect(data.toString("hex")).to.equal("000100000003019604");

                client.end();
                done();
            });
        });

        // TODO: exceptions
    });

    describe("socket connection error", function() {
        it("should receive an error event on socket closed by client", function(done) {
            const client = net.connect({ host: "0.0.0.0", port: 8514 }, function() {
                client.destroy();

                serverTCP.emit("socketError");
            });

            serverTCP.on("socketError", function() {
                // Error handled correctly
                done();
            });
        });

        // TODO: exceptions
    });

    describe("large client request", function() {
        it("should handle a large request without crash successfully (FC1)", function(done) {
            const client = net.connect({ host: "0.0.0.0", port: 8514 }, function() {
                // request 65535 registers at once
                client.write(Buffer.from("0001000000060101003EFFFF", "hex"));
            });

            client.once("data", function(data) {
                // A valid error message, code 0x04 - Slave failure
                expect(data.toString("hex")).to.equal("000100000003018104");
                done();
            });
        });

        it("should handle a large request without crash successfully (FC3)", function(done) {
            const client = net.connect({ host: "0.0.0.0", port: 8514 }, function() {
                // request 65535 registers at once
                client.write(Buffer.from("0001000000060103003EFFFF", "hex"));
            });

            client.once("data", function(data) {
                // A valid error message, code 0x04 - Slave failure
                expect(data.toString("hex")).to.equal("000100000003018304");
                done();
            });
        });

        it("should handle a large request without crash successfully (FC4)", function(done) {
            const client = net.connect({ host: "0.0.0.0", port: 8514 }, function() {
                // request 65535 registers at once
                client.write(Buffer.from("0001000000060104003EFFFF", "hex"));
            });

            client.once("data", function(data) {
                // A valid error message, code 0x04 - Slave failure
                expect(data.toString("hex")).to.equal("000100000003018404");
                done();
            });
        });
    });
});
