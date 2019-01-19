"use strict";
/* eslint-disable no-undef, no-console */

var expect = require("chai").expect;
var net = require("net");
var TcpServer = require("./../../servers/servertcp");

describe("Modbus TCP Server Callback", function() {
    var serverTCP; // eslint-disable-line no-unused-vars

    before(function() {
        var vector = {
            getInputRegister: function(addr, unit, callback) {
                setTimeout(function() {
                    callback(null, addr);
                }, 50);
            },
            getHoldingRegister: function(addr, unit, callback) {
                setTimeout(function() {
                    if (addr === 0x003E) {
                        callback(new Error());
                        return;
                    }

                    callback(null, addr + 8000);
                }, 50);
            },
            getCoil: function(addr, unit, callback) {
                setTimeout(function() {
                    callback(null, (addr % 2) === 0);
                }, 50);
            },
            setRegister: function(addr, value, unit, callback) {
                setTimeout(function() {
                    console.log("set register", addr, value);
                    callback(null);
                }, 50);
            },
            setCoil: function(addr, value, unit, callback) {
                setTimeout(function() {console.log("\tset coil", addr, value);
                    callback(null);
                }, 50);
            }
        };
        serverTCP = new TcpServer(vector, { host: "0.0.0.0", port: 8513, debug: true, unitID: 1 });
    });

    after(function() {
        serverTCP.close();
    });

    describe("function code handler", function() {
        it("should receive a valid Modbus TCP message", function(done) {
            const client = net.connect({ host: "0.0.0.0", port: 8513 }, function() {
                // FC05 - force single coil, to on 0xff00
                client.write(Buffer.from("00010000000601050005ff00", "hex"));
            });

            client.once("data", function(data) {
                // FC05 - valid responce
                expect(data.toString("hex")).to.equal("00010000000601050005ff00");
                done();
            });
        });

        // TODO: FC1 - FCX tests
    });

    describe("modbus exception handler", function() {
        it("should receive a valid Modbus TCP message", function(done) {
            const client = net.connect({ host: "0.0.0.0", port: 8513 }, function() {
                // FC07 - unhandled function
                client.write(Buffer.from("000100000006010700000000", "hex"));
            });

            client.once("data", function(data) {
                // A valid error message, code 0x01 - Illegal fanction
                expect(data.toString("hex")).to.equal("000100000003018701");
                done();
            });
        });

        it("should receive a valid slave failure Modbus TCP message", function(done) {
            const client = net.connect({ host: "0.0.0.0", port: 8513 }, function() {
                // FC03 to error triggering address
                client.write(Buffer.from("0001000000060103003E0001", "hex"));
            });

            client.once("data", function(data) {
                // A valid error message, code 0x04 - Slave failure
                expect(data.toString("hex")).to.equal("000100000003018304");
                done();
            });
        });

        // TODO: exceptions
    });

    describe("socket connection error", function() {
        it("should receive an error event on socket closed by client", function(done) {
            var client = net.connect({ host: "0.0.0.0", port: 8513 }, function() {
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
            var client = net.connect({ host: "0.0.0.0", port: 8513 }, function() {
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
            var client = net.connect({ host: "0.0.0.0", port: 8513 }, function() {
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
            var client = net.connect({ host: "0.0.0.0", port: 8513 }, function() {
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
