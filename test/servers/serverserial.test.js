"use strict";
/* eslint-disable no-undef, no-console */

/**
 * Tests require two linked serial connections:
 *
 * Create two ports /tmp/ttyp0 for the server, /tmp/ptyp0 for the client,
 * enable copying to stderr for debugging to see raw messages across connection.
 *
 * sudo socat -v -x -d -d PTY,link=/tmp/ptyp0,raw,echo=0,ispeed=b9600 PTY,link=/tmp/ttyp0,raw,echo=0,ospeed=b9600
 * sudo chown user:user /tmp/ttyp0 /tmp/ptyp0
 */

const { MockBinding } = require("@serialport/binding-mock");
const { SerialPortStream } = require("@serialport/stream");
const expect = require("chai").expect;
// const { SerialPort } = require("serialport");
const ServerSerial = require("./../../servers/serverserial");

// FYI, maximum length for requests.
// const MAX_COIL = 2040;
// const MAX_DISCRETE_INPUT = 2040;
// const MAX_INPUT = 127;
// const MAX_HOLDING_REGISTER = 127;

describe("Modbus Serial Server (no serverID)", function() {
    let serverSerial; // eslint-disable-line no-unused-vars
    let clientSerial; // eslint-disable-line no-unused-vars

    beforeEach(function() {
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

        MockBinding.createPort("/dev/server", { echo: true, record: true });
        MockBinding.createPort("/dev/client", { echo: true, record: true });

        clientSerial = new SerialPortStream({
            binding: MockBinding,
            path: "/dev/client",
            baudRate: 9600
        });

        serverSerial = new ServerSerial(vector, {
            binding: MockBinding,
            port: "/dev/server",
            portResponse: clientSerial,
            debug: true
        });
    });

    afterEach(function() {
        serverSerial.close();
    });

    describe("function code handler", function() {
        it("should receive a valid Modbus Serial message", function(done) {
            let awaitingResponse = false;

            clientSerial.write(Buffer.from("01050001ff00ddfa", "hex"));

            clientSerial.on("data", function(data) {
                if (awaitingResponse === false) {
                    // Client request forwarded to server
                    awaitingResponse = true;
                    serverSerial.getPort().write(data);
                } else {
                    // Client received response
                    awaitingResponse = false;

                    // FC05 - valid responce
                    expect(data.toString("hex")).to.equal("01050001ff00ddfa");

                    clientSerial.close();
                    done();
                }
            });
        });

        // TODO: FC1 - FCX tests
    });

    describe("modbus exception handler", function() {
        it("should receive a valid unhandled function Modbus Serial message", function(done) {
            let awaitingResponse = false;

            // FC07 - unhandled function
            clientSerial.write(Buffer.from("01070001ff00ddfa", "hex"));

            clientSerial.on("data", function(data) {
                if (awaitingResponse === false) {
                    // Client request forwarded to server
                    awaitingResponse = true;
                    serverSerial.getPort().write(data);
                } else {
                    // Client received response
                    awaitingResponse = false;

                    // A valid error message, code 0x01 - Illegal fanction
                    expect(data.toString("hex")).to.equal("0187018230");

                    clientSerial.close();
                    done();
                }
            });
        });

        it("should receive a valid slave failure Modbus Serial message", function(done) {
            let awaitingResponse = false;

            // FC03 to error triggering address
            clientSerial.write(Buffer.from("0103003E0001ddfa", "hex"));

            clientSerial.on("data", function(data) {
                if (awaitingResponse === false) {
                    // Client request forwarded to server
                    awaitingResponse = true;
                    serverSerial.getPort().write(data);
                } else {
                    // Client received response
                    awaitingResponse = false;

                    // A valid error message, code 0x04 - Slave failure
                    expect(data.toString("hex")).to.equal("01830440f3");

                    clientSerial.close();
                    done();
                }
            });
        });

        // TODO: exceptions
    });

    describe("large client request", function() {
        it("should handle a large request without crash successfully (FC1)", function(done) {
            let awaitingResponse = false;

            // request `maximum number` + 1 of coil addresses at once
            clientSerial.write(Buffer.from("0101000007f9fe78", "hex"));

            clientSerial.on("data", function(data) {
                if (awaitingResponse === false) {
                    // Client request forwarded to server
                    awaitingResponse = true;
                    serverSerial.getPort().write(data);
                } else {
                    // Client received response
                    awaitingResponse = false;

                    // A valid error message, code 0x04 - Slave failure
                    expect(data.toString("hex")).to.equal("0181044193");

                    clientSerial.close();
                    done();
                }
            });
        });

        it("should handle a large request without crash successfully (FC3)", function(done) {
            let awaitingResponse = false;

            // request `maximum number` + 1 of holding addresses at once
            clientSerial.write(Buffer.from("010300000080446a", "hex"));

            clientSerial.on("data", function(data) {
                if (awaitingResponse === false) {
                    // Client request forwarded to server
                    awaitingResponse = true;
                    serverSerial.getPort().write(data);
                } else {
                    // Client received response
                    awaitingResponse = false;

                    // A valid error message, code 0x04 - Slave failure
                    expect(data.toString("hex")).to.equal("01830440f3");

                    clientSerial.close();
                    done();
                }
            });
        });

        it("should handle a large request without crash successfully (FC4)", function(done) {
            let awaitingResponse = false;

            // request `maximum number` + 1 of input addresses at once
            clientSerial.write(Buffer.from("010400000080f1aa", "hex"));

            clientSerial.on("data", function(data) {
                if (awaitingResponse === false) {
                    // Client request forwarded to server
                    awaitingResponse = true;
                    serverSerial.getPort().write(data);
                } else {
                    // Client received response
                    awaitingResponse = false;

                    // A valid error message, code 0x04 - Slave failure
                    expect(data.toString("hex")).to.equal("01840442c3");

                    clientSerial.close();
                    done();
                }
            });
        });

        // TODO: exceptions
    });
});

describe("Modbus Serial Server (serverID = requestID)", function() {
    let serverSerial; // eslint-disable-line no-unused-vars
    let clientSerial; // eslint-disable-line no-unused-vars

    before(function() {
        const vector = {
            setCoil: function(addr, value) {
                console.log("\tset coil", addr, value);
                return;
            }
        };

        MockBinding.createPort("/dev/server", { echo: true, record: true });
        MockBinding.createPort("/dev/client", { echo: true, record: true });

        clientSerial = new SerialPortStream({
            binding: MockBinding,
            path: "/dev/client",
            baudRate: 9600
        });

        serverSerial = new ServerSerial(vector, {
            binding: MockBinding,
            port: "/dev/server",
            portResponse: clientSerial,
            debug: true,
            unitID: 4
        });
    });

    after(function() {
        serverSerial.close();
    });

    describe("function code handler", function() {
        it("should receive a valid Modbus Serial message", function(done) {
            let awaitingResponse = false;

            // FC05 - force single coil, to on 0xff00
            clientSerial.write(Buffer.from("04050001ff00ddaf", "hex"));

            clientSerial.on("data", function(data) {
                if (awaitingResponse === false) {
                    // Client request forwarded to server
                    awaitingResponse = true;
                    serverSerial.getPort().write(data);
                } else {
                    // Client received response
                    awaitingResponse = false;
                    // FC05 - valid responce
                    expect(data.toString("hex")).to.equal("04050001ff00ddaf");

                    clientSerial.close();
                    done();
                }
            });
        });
    });
});

describe("Modbus Serial Server (serverID != requestID)", function() {
    let serverSerial; // eslint-disable-line no-unused-vars
    let clientSerial; // eslint-disable-line no-unused-vars

    before(function() {
        const vector = {
            setCoil: function(addr, value) {
                console.log("\tset coil", addr, value);
                return;
            }
        };

        MockBinding.createPort("/dev/server", { echo: true, record: true });
        MockBinding.createPort("/dev/client", { echo: true, record: true });

        clientSerial = new SerialPortStream({
            binding: MockBinding,
            path: "/dev/client",
            baudRate: 9600
        });

        serverSerial = new ServerSerial(vector, {
            binding: MockBinding,
            port: "/dev/server",
            portResponse: clientSerial,
            debug: true,
            unitID: 4
        });
    });

    after(function() {
        serverSerial.close();
    });

    describe("function code handler", function() {
        it("should receive a no Modbus Serial message for wrong unitID", function(done) {
            this.timeout(1000 + 100);

            let awaitingResponse = false;

            // FC05 - force single coil on unitID 3, to on 0xff00
            clientSerial.write(Buffer.from("03050001ff00ddaf", "hex"));
            function cleanup() {
                clientSerial.close();
                done();
            }
            const timeout = setTimeout(cleanup, 1000);

            clientSerial.on("data", function(data) {
                if (awaitingResponse === false) {
                    // Client request forwarded to server
                    awaitingResponse = true;
                    serverSerial.getPort().write(data);
                } else {
                    // Client received response
                    awaitingResponse = false;

                    clearTimeout(timeout);
                    clientSerial.close();
                    expect.fail("Shouldn't have received data - we specified wrong unitID.");
                }
            });
        });
    });
});
