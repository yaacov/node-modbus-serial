"use strict";
/* eslint-disable no-undef, no-console */

const expect = require("chai").expect;
const net = require("net");
const Server = require("./../../servers/server");

describe("Modbus RTU Server (no serverID)", function() {
    let server; // eslint-disable-line no-unused-vars

    before(function() {
        const vector = {
            getInputRegister: function(addr) {
                return addr;
            },
            getHoldingRegister: function(addr) {
                console.log("getHoldingRegister", addr);
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
        server = new Server(vector, { host: "0.0.0.0", port: 8512, debug: true });
    });

    after(function() {
        server.close();
    });

    describe("function code handler", function() {
        it("should receive a valid Modbus RTU message", function(done) {
            const client = net.connect({ host: "0.0.0.0", port: 8512 }, function() {
                // FC05 - force single coil, to on 0xff00
                console.log("connect");
                client.write(Buffer.from("01050005ff009c3b", "hex"));
            });

            client.once("data", function(data) {
                // FC05 - valid responce
                expect(data.toString("hex")).to.equal("01050005ff009c3b");

                client.end();
                done();
            });
        });

        // TODO: FC1 - FCX tests
    });

    describe("modbus exception handler", function() {
        it("should receive a valid unhandled function Modbus RTU message", function(done) {
            const client = net.connect({ host: "0.0.0.0", port: 8512 }, function() {
                // FC07 - unhandled function
                client.write(Buffer.from("0107000000000000", "hex"));
            });

            client.once("data", function(data) {
                // A valid error message, code 0x01 - Illegal function
                expect(data.toString("hex")).to.equal("0187018230");

                client.end();
                done();
            });
        });

        it("should receive a valid slave failure Modbus RTU message", function(done) {
            const client = net.connect({ host: "0.0.0.0", port: 8512 }, function() {
                // FC03 to error triggering address
                client.write(Buffer.from("0103003E00010000", "hex"));
            });

            client.once("data", function(data) {
                // A valid error message, code 0x04 - Slave failure
                expect(data.toString("hex")).to.equal("01830440f3");

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

                server.emit("socketError");
            });

            server.on("socketError", function() {
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
                client.write(Buffer.from("0101003EFFFF0000", "hex"));
            });

            client.once("data", function(data) {
                // A valid error message, code 0x04 - Slave failure
                expect(data.toString("hex")).to.equal("0181044193");

                client.end();
                done();
            });
        });

        it("should handle a large request without crash successfully (FC3)", function(done) {
            const client = net.connect({ host: "0.0.0.0", port: 8512 }, function() {
                // request 65535 registers at once
                client.write(Buffer.from("0103003EFFFF0000", "hex"));
            });

            client.once("data", function(data) {
                // A valid error message, code 0x04 - Slave failure
                expect(data.toString("hex")).to.equal("01830440f3");

                client.end();
                done();
            });
        });

        it("should handle a large request without crash successfully (FC4)", function(done) {
            const client = net.connect({ host: "0.0.0.0", port: 8512 }, function() {
                // request 65535 registers at once
                client.write(Buffer.from("0104003EFFFF0000", "hex"));
            });

            client.once("data", function(data) {
                // A valid error message, code 0x04 - Slave failure
                expect(data.toString("hex")).to.equal("01840442c3");

                client.end();
                done();
            });
        });

        // TODO: exceptions
    });
});

describe("Modbus RTU Server (serverID = requestID)", function() {
    let server; // eslint-disable-line no-unused-vars

    before(function() {
        const vector = {
            setCoil: function(addr, value) {
                console.log("\tset coil", addr, value);
                return;
            }
        };
        server = new Server(vector, { host: "0.0.0.0", port: 8512, debug: true, unitID: 0x04 });
    });

    after(function() {
        server.close();
    });

    describe("function code handler", function() {
        it("should receive a valid Modbus RTU message", function(done) {
            const client = net.connect({ host: "0.0.0.0", port: 8512 }, function() {
                // FC05 - force single coil, to on 0xff00
                client.write(Buffer.from("04050005ff000000", "hex"));
            });

            client.once("data", function(data) {
                // FC05 - valid responce
                expect(data.toString("hex")).to.equal("04050005ff009c6e");

                client.end();
                done();
            });
        });
    });
});

describe("Modbus RTU Server (serverID != requestID)", function() {
    let server; // eslint-disable-line no-unused-vars

    before(function() {
        const vector = {
            setCoil: function(addr, value) {
                console.log("\tset coil", addr, value);
                return;
            }
        };
        server = new Server(vector, { host: "0.0.0.0", port: 8512, debug: true, unitID: 0x04 });
    });

    after(function() {
        server.close();
    });

    describe("function code handler", function() {
        it("should receive a no Modbus RTU message for wrong unitID", function(done) {
            let timeout;
            this.timeout(1000 + 100);

            const client = net.connect({ host: "0.0.0.0", port: 8512 }, function() {
                // FC05 - force single coil, to on 0xff00
                client.write(Buffer.from("03050005ff00", "hex"));
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
