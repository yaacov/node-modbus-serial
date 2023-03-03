"use strict";
/* eslint-disable no-undef, no-console */

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
// Load chai-as-promised support
chai.use(chaiAsPromised);
// Initialise should API (attaches as a property on Object)
chai.should();

const net = require("net");
const TcpServer = require("../../servers/servertcp");
const Modbus = require("../../");

const holdingRegisters = {};

describe("Modbus TCP Server (Enron)", function() {
    let serverTCP; // eslint-disable-line no-unused-vars
    let modbusClient;

    before(function() {
        const vector = {
            getHoldingRegister: function(addr) {
                return holdingRegisters[addr];
            },
            setRegister: function(addr, value) {
                holdingRegisters[addr] = value;
                return;
            },
            getMultipleHoldingRegisters: function(startAddr, length) {
                const values = [];
                for (let i = 0; i < length; i++) {
                    values[i] = holdingRegisters[startAddr + i];
                }
                return values;
            }
        };
        serverTCP = new TcpServer(vector, {
            host: "0.0.0.0",
            unitId: 1,
            port: 8512,
            debug: true,
            enron: true,
            enronTables: {
                booleanRange: [1001, 1999],
                shortRange: [3001, 3999],
                longRange: [5001, 5999],
                floatRange: [7001, 7999]
            }
        });
        modbusClient = new Modbus();
    });

    after(function() {
        serverTCP.close();
        modbusClient.close();
    });

    describe("function code handler", function() {
        it("should receive a valid Modbus TCP message", function(done) {
            const client = net.connect({ host: "0.0.0.0", port: 8512 }, function() {
                // FC06 - write single register 5, to 0x0000ff00
                client.write(Buffer.from("000100000008010600050000ff00", "hex"));
            });

            client.once("data", function(data) {
                // FC06 - valid responce
                chai.expect(data.toString("hex")).to.equal("000100000008010600050000ff00");

                client.end();
                done();
            });
        });
    });

    describe("function code handler", function() {
        it("should write and receive a valid 32bit integer Modbus (Enron) TCP message", function(done) {
            const address = 5001;
            const value = 305419896;

            function verify(msg) {
                // FC06 - valid responce
                chai.expect(msg.data[0]).to.equal(value);
                done();
            }

            function read() {
                modbusClient.readRegistersEnron(address, 1).then(verify);
            }

            function write() {
                modbusClient
                    .writeRegisterEnron(address, value)
                    .then(read);
            }

            modbusClient.connectTCP(
                "0.0.0.0",
                {
                    port: 8512,
                    enron: true,
                    enronTables: {
                        booleanRange: [1001, 1999],
                        shortRange: [3001, 3999],
                        longRange: [5001, 5999],
                        floatRange: [7001, 7999]
                    }
                },
                write);
            modbusClient.setID(1);
        });
    });

    describe("function code handler", function() {
        it("should receive a range error when trying to write a 32bit integer to a 16bit table", function(done) {
            const address = 3001;
            const value = 305419896;

            async function write() {
                await chai.expect(modbusClient.writeRegisterEnron(address, value))
                    .to.eventually
                    .be.rejectedWith(RangeError);
                done();
            }

            modbusClient.connectTCP(
                "0.0.0.0",
                {
                    port: 8512,
                    enron: true,
                    enronTables: {
                        booleanRange: [1001, 1999],
                        shortRange: [3001, 3999],
                        longRange: [5001, 5999],
                        floatRange: [7001, 7999]
                    }
                },
                write);
            modbusClient.setID(1);
        });
    });

    describe("function code handler", function() {
        it("should receive exception when enron is chosen but no table is defined in options", function(done) {
            const address = 5001;
            const value = 305419896;

            async function write() {
                await chai.expect(modbusClient.writeRegisterEnron(address, value))
                    .to.eventually
                    .be.rejectedWith(Error);
                done();
            }

            modbusClient.connectTCP(
                "0.0.0.0",
                {
                    port: 8512,
                    enron: true
                },
                write);
            modbusClient.setID(1);
        });
    });

    describe("function code handler", function() {
        it("should receive exception when enron is chosen but no valid table-shortRange is defined in options", function(done) {
            const address = 5001;
            const value = 305419896;

            async function write() {
                await chai.expect(modbusClient.writeRegisterEnron(address, value))
                    .to.eventually
                    .be.rejectedWith(Error);
                done();
            }

            modbusClient.connectTCP(
                "0.0.0.0",
                {
                    port: 8512,
                    enron: true,
                    enronTables: {
                        shortRange: [4, 3] // Should be [start, end], not [end, start]
                    }
                },
                write);
            modbusClient.setID(1);
        });
    });
});
