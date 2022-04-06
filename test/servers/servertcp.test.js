"use strict";
/* eslint-disable no-undef, no-console */

const expect = require("chai").expect;
const net = require("net");
const TcpServer = require("./../../servers/servertcp");

describe("Modbus TCP Server (no serverID)", function() {
    let serverTCP; // eslint-disable-line no-unused-vars

    before(function() {
        const vector = {
            getInputRegister: function(addr) {
                return addr;
            },
            getHoldingRegister: function(addr) {
                if (addr === 62)
                    throw new Error();

                console.log("\tHolding register: ", addr);

                return addr + 8000;
            },
            getCoil: function(addr) {
                console.log("\tHolding register: ", addr);
                return (addr % 2) === 0;
            },
            setRegister: function(addr, value) {
                console.log("\tset register", addr, value);
                return;
            },
            setCoil: function(addr, value) {
                console.log("\tset coil", addr, value);
                return;
            }
        };
        serverTCP = new TcpServer(vector, { host: "0.0.0.0", port: 8512, debug: true });
    });

    after(function() {
        serverTCP.close();
    });

    describe("function code handler", function() {
        it("should receive a valid Modbus TCP message", function(done) {
            const client = net.connect({ host: "0.0.0.0", port: 8512 }, function() {
                // FC05 - force single coil, to on 0xff00
                client.write(Buffer.from("00010000000601050005ff00", "hex"));
            });

            client.once("data", function(data) {
                // FC05 - valid responce
                expect(data.toString("hex")).to.equal("00010000000601050005ff00");

                client.end();
                done();
            });
        });

        // TODO: FC1 - FCX tests
    });

    describe("modbus exception handler", function() {
        it("should receive a valid unhandled function Modbus TCP message", function(done) {
            const client = net.connect({ host: "0.0.0.0", port: 8512 }, function() {
                // FC07 - unhandled function
                client.write(Buffer.from("000100000006010700000000", "hex"));
            });

            client.once("data", function(data) {
                // A valid error message, code 0x01 - Illegal fanction
                expect(data.toString("hex")).to.equal("000100000003018701");

                client.end();
                done();
            });
        });

        it("should receive a valid slave failure Modbus TCP message", function(done) {
            const client = net.connect({ host: "0.0.0.0", port: 8512 }, function() {
                // FC03 to error triggering address
                client.write(Buffer.from("0001000000060103003E0001", "hex"));
            });

            client.once("data", function(data) {
                // A valid error message, code 0x04 - Slave failure
                expect(data.toString("hex")).to.equal("000100000003018304");

                client.end();
                done();
            });
        });

        // TODO: exceptions
    });

    describe("socket connection error", function() {
        it("should receive an error event on socket closed by client", function(done) {
            const client = net.connect({ host: "0.0.0.0", port: 8512 }, function() {
                client.destroy();

                serverTCP.emit("socketError");
            });

            serverTCP.on("socketError", function() {
                // Error handled correctly
                client.end();
                done();
            });
        });

        // TODO: exceptions
    });

    describe("large client request", function() {
        it("should handle a large request without crash successfully (FC1)", function(done) {
            const client = net.connect({ host: "0.0.0.0", port: 8512 }, function() {
                // request 65535 registers at once
                client.write(Buffer.from("0001000000060101003EFFFF", "hex"));
            });

            client.once("data", function(data) {
                // A valid error message, code 0x04 - Slave failure
                expect(data.toString("hex")).to.equal("000100000003018104");

                client.end();
                done();
            });
        });

        it("should handle a large request without crash successfully (FC3)", function(done) {
            const client = net.connect({ host: "0.0.0.0", port: 8512 }, function() {
                // request 65535 registers at once
                client.write(Buffer.from("0001000000060103003EFFFF", "hex"));
            });

            client.once("data", function(data) {
                // A valid error message, code 0x04 - Slave failure
                expect(data.toString("hex")).to.equal("000100000003018304");

                client.end();
                done();
            });
        });

        it("should handle a large request without crash successfully (FC4)", function(done) {
            const client = net.connect({ host: "0.0.0.0", port: 8512 }, function() {
                // request 65535 registers at once
                client.write(Buffer.from("0001000000060104003EFFFF", "hex"));
            });

            client.once("data", function(data) {
                // A valid error message, code 0x04 - Slave failure
                expect(data.toString("hex")).to.equal("000100000003018404");

                client.end();
                done();
            });
        });

        // TODO: exceptions
    });
});

describe("Modbus TCP Server (serverID = requestID)", function() {
    let serverTCP; // eslint-disable-line no-unused-vars

    before(function() {
        const vector = {
            setCoil: function(addr, value) {
                console.log("\tset coil", addr, value);
                return;
            }
        };
        serverTCP = new TcpServer(vector, { host: "0.0.0.0", port: 8512, debug: true, unitID: 0x04 });
    });

    after(function() {
        serverTCP.close();
    });

    describe("function code handler", function() {
        it("should receive a valid Modbus TCP message", function(done) {
            const client = net.connect({ host: "0.0.0.0", port: 8512 }, function() {
                // FC05 - force single coil, to on 0xff00
                client.write(Buffer.from("00010000000604050005ff00", "hex"));
            });

            client.once("data", function(data) {
                // FC05 - valid responce
                expect(data.toString("hex")).to.equal("00010000000604050005ff00");

                client.end();
                done();
            });
        });
    });
});

describe("Modbus TCP Server (serverID != requestID)", function() {
    let serverTCP; // eslint-disable-line no-unused-vars

    before(function() {
        const vector = {
            setCoil: function(addr, value) {
                console.log("\tset coil", addr, value);
                return;
            }
        };
        serverTCP = new TcpServer(vector, { host: "0.0.0.0", port: 8512, debug: true, unitID: 0x04 });
    });

    after(function() {
        serverTCP.close();
    });

    describe("function code handler", function() {
        it("should receive a no Modbus TCP message for wrong unitID", function(done) {
            let timeout;
            this.timeout(1000 + 100);

            const client = net.connect({ host: "0.0.0.0", port: 8512 }, function() {
                // FC05 - force single coil, to on 0xff00
                client.write(Buffer.from("00010000000603050005ff00", "hex"));
                timeout = setTimeout(done, 1000);
            });

            client.once("data", function(data) {
                clearTimeout(timeout);

                // FC05 - we expect no data for wrong unitID
                expect(data.toString("hex")).to.equal("NO DATA");

                client.end();
                done();
            });
        });
    });
});
