"use strict";
/* eslint-disable no-undef */

const ModbusRTU = require("../index");
const TestPort = ModbusRTU.TestPort;
const testPort = new TestPort();
const modbusRTU = new ModbusRTU(testPort);

const sinon = require("sinon");
const expect = require("chai").expect;

describe("ModbusRTU", function() {

    describe("Setup", function() {
        describe("#open() - open serial port.", function() {
            it("should open the port without errors", function(done) {
                modbusRTU.open(function(err) {
                    expect(err).to.be.a("null");
                    done();
                });
            });
        });

        describe("#close() - close serial port.", function() {
            it("should close the port without errors", function(done) {
                modbusRTU.close(function(err) {
                    expect(err).to.be.a("null");

                    done();
                });
            });
        });
    });

    describe("FunctionCodes", function() {
        beforeEach(function(done) {
            modbusRTU.open(function() {
                done();
            });
        });

        afterEach(function(done) {
            modbusRTU.close(function() {
                done();
            });
        });

        describe("#writeFC3() - read holding registers.", function() {
            it("should read 3 registers [0xa12b, 0xffff, 0xb21a] without errors", function(done) {
                modbusRTU.writeFC3(1, 8, 3, function(err, data) {
                    expect(err).to.be.a("null");
                    expect(data).to.have.property("data").with.length(3);
                    expect(data.data.toString()).to.equal([0xa12b, 0xffff, 0xb21a].toString());

                    done();
                });
            });

            it("should read raw buffer \"a12bffffb21a\" without errors", function(done) {
                modbusRTU.writeFC3(1, 8, 3, function(err, data) {
                    expect(err).to.be.a("null");
                    expect(data).to.have.property("buffer");
                    expect(data.buffer.toString("hex")).to.equal("a12bffffb21a");

                    done();
                });
            });

            it("should fail on short data answer", function(done) {
                modbusRTU.writeFC3(2, 8, 3, function(err) {
                    expect(err.message).to.have.string("Data length error");

                    done();
                });
            });

            it("should fail on CRC error", function(done) {
                modbusRTU.writeFC3(3, 8, 3, function(err) {
                    expect(err.message).to.have.string("CRC error");

                    done();
                });
            });

            it("should fail on unexpected reply", function(done) {
                modbusRTU.writeFC3(4, 8, 3, function(err) {
                    expect(err.message).to.have.string("Unexpected data error");

                    done();
                });
            });

            it("should fail with an exception", function(done) {
                modbusRTU.writeFC3(5, 8, 3, function(err) {
                    expect(err.message).to.have.string("Modbus exception");

                    done();
                });
            });
        });

        describe("#writeFC4() - read input registers.", function() {
            it("should read 3 registers [8, 9, 10] without errors", function(done) {
                modbusRTU.writeFC4(1, 8, 3, function(err, data) {
                    expect(err).to.be.a("null");
                    expect(data).to.have.property("data").with.length(3);
                    expect(data.data.toString()).to.equal([8, 9, 10].toString());

                    done();
                });
            });

            it("should fail on short data answer", function(done) {
                modbusRTU.writeFC4(2, 8, 1, function(err) {
                    expect(err.message).to.have.string("Data length error");

                    done();
                });
            });

            it("should fail on CRC error", function(done) {
                modbusRTU.writeFC4(3, 8, 1, function(err) {
                    expect(err.message).to.have.string("CRC error");

                    done();
                });
            });

            it("should fail on unexpected reply", function(done) {
                modbusRTU.writeFC4(4, 8, 1, function(err) {
                    expect(err.message).to.have.string("Unexpected data error");

                    done();
                });
            });

            it("should fail with an exception", function(done) {
                modbusRTU.writeFC4(5, 8, 3, function(err) {
                    expect(err.message).to.have.string("Modbus exception");

                    done();
                });
            });
        });

        describe("#writeFC6() - write single holding register.", function() {
            it("should write to register 1 42 without errors", function(done) {
                modbusRTU.writeFC6(1, 1, 42, function(err, data) {
                    expect(err).to.be.a("null");
                    expect(data.address).to.equal(1);
                    expect(data.value).to.equal(42);

                    done();
                });
            });

            it("should fail on short data answer", function(done) {
                modbusRTU.writeFC6(2, 1, 42, function(err) {
                    expect(err.message).to.have.string("Data length error");

                    done();
                });
            });

            it("should fail on CRC error", function(done) {
                modbusRTU.writeFC6(3, 1, 42, function(err) {
                    expect(err.message).to.have.string("CRC error");

                    done();
                });
            });

            it("should fail on unexpected reply", function(done) {
                modbusRTU.writeFC6(4, 1, 42, function(err) {
                    expect(err.message).to.have.string("Unexpected data error");

                    done();
                });
            });

            it("should fail with an exception", function(done) {
                modbusRTU.writeFC6(5, 1, 42, function(err) {
                    expect(err.message).to.have.string("Modbus exception");

                    done();
                });
            });
        });

        describe("#writeFC15() - force multiple coils.", function() {
            it("should write 3 coils [true, false, true] without errors", function(done) {
                modbusRTU.writeFC15(1, 8, [true, false, true], function(err) {
                    expect(err).to.be.a("null");

                    done();
                });
            });

            it("should fail on short data answer", function(done) {
                modbusRTU.writeFC15(2, 8, [true, false, true], function(err) {
                    expect(err.message).to.have.string("Data length error");

                    done();
                });
            });

            it("should fail on CRC error", function(done) {
                modbusRTU.writeFC15(3, 8, [true, false, true], function(err) {
                    expect(err.message).to.have.string("CRC error");

                    done();
                });
            });

            it("should fail on unexpected reply", function(done) {
                modbusRTU.writeFC15(4, 8, [true, false, true], function(err) {
                    expect(err.message).to.have.string("Unexpected data error");

                    done();
                });
            });

            it("should fail with an exception", function(done) {
                modbusRTU.writeFC15(5, 8, [true, false, true], function(err) {
                    expect(err.message).to.have.string("Modbus exception");

                    done();
                });
            });
        });

        describe("#writeFC1() - read coils after force multiple coils.", function() {
            it("should read coil 8, 9 ,10 to be true, false, true", function(done) {
                modbusRTU.writeFC1(1, 8, 4, function(err, data) {
                    expect(err).to.be.a("null");
                    expect(data).to.have.property("data");
                    expect(data.data[0]).to.equal(true);
                    expect(data.data[1]).to.equal(false);
                    expect(data.data[2]).to.equal(true);

                    done();
                });
            });
        });

        describe("#writeFC16() - write holding registers.", function() {
            it("should write 3 registers [42, 128, 5] without errors", function(done) {
                modbusRTU.writeFC16(1, 8, [42, 128, 5], function(err) {
                    expect(err).to.be.a("null");

                    done();
                });
            });

            it("should fail on short data answer", function(done) {
                modbusRTU.writeFC16(2, 8, [42, 128, 5], function(err) {
                    expect(err.message).to.have.string("Data length error");

                    done();
                });
            });

            it("should fail on CRC error", function(done) {
                modbusRTU.writeFC16(3, 8, [42, 128, 5], function(err) {
                    expect(err.message).to.have.string("CRC error");

                    done();
                });
            });

            it("should fail on unexpected reply", function(done) {
                modbusRTU.writeFC16(4, 8, [42, 128, 5], function(err) {
                    expect(err.message).to.have.string("Unexpected data error");

                    done();
                });
            });

            it("should fail with an exception", function(done) {
                modbusRTU.writeFC16(5, 8, [42, 128, 5], function(err) {
                    expect(err.message).to.have.string("Modbus exception");

                    done();
                });
            });
        });

        describe("#writeFC3() - read holding registers after write.", function() {
            it("should read 3 registers [42, 128, 5] without errors", function(done) {
                modbusRTU.writeFC3(1, 8, 3, function(err, data) {
                    expect(err).to.be.a("null");
                    expect(data).to.have.property("data").with.length(3);
                    expect(data.data.toString()).to.equal([42, 128, 5].toString());

                    done();
                });
            });

            it("should include raw payload data in response if debug enabled", function(done) {
                /* This feature is common to _all_ function handlers. */
                modbusRTU.isDebugEnabled = true;

                modbusRTU.writeFC3(1, 8, 3, function(err, data) {
                    modbusRTU.isDebugEnabled = false;

                    expect(err).to.be.a("null");
                    expect(data).to.have.property("request").with.length(8);
                    expect(data.request.toString("hex")).to.equal("0103000800038409");

                    expect(data).to.have.property("responses").with.length(1);
                    expect(data.responses[0]).to.be.instanceof(Buffer).with.length(11);
                    expect(data.responses[0].toString("hex")).to.equal("010306002a00800005f958");

                    done();
                });
            });

            it("should include raw payload data in exception if debug enabled", function(done) {
                /* This feature is common to _all_ function handlers. */
                modbusRTU.isDebugEnabled = true;

                // Pretend Unit 3 sends buggy CRCs apparently.
                modbusRTU.writeFC3(3, 8, 3, function(err, data) {
                    modbusRTU.isDebugEnabled = false;

                    expect(err).to.not.be.a("null");
                    expect(err).to.have.property("modbusRequest").with.length(8);
                    expect(err.modbusRequest.toString("hex")).to.equal("03030008000385eb");

                    expect(err).to.have.property("modbusResponses").with.length(1);
                    expect(err.modbusResponses[0]).to.be.instanceof(Buffer).with.length(11);
                    expect(err.modbusResponses[0].toString("hex")).to.equal("030306002a00800005e138");

                    expect(data).to.be.undefined;

                    done();
                });
            });
        });

        describe("#writeFC5() - force one coil.", function() {
            it("should force coil 3 to be true, without errors", function(done) {
                modbusRTU.writeFC5(1, 3, true, function(err, data) {
                    expect(err).to.be.a("null");
                    expect(data).to.have.property("state");
                    expect(data.state).to.equal(true);

                    done();
                });
            });
        });

        describe("#writeFC1() - read coils after force coil.", function() {
            it("should read coil 3 to be true, without errors", function(done) {
                modbusRTU.writeFC1(1, 3, 9, function(err, data) {
                    expect(err).to.be.a("null");
                    expect(data).to.have.property("data");
                    expect(data.data[0]).to.equal(true);
                    expect(data.data[3]).to.equal(false);

                    done();
                });
            });
        });

        describe("#writeFC1() - read inputs.", function() {
            it("should read input 0 to be false, without errors", function(done) {
                modbusRTU.writeFC1(1, 0, 9, function(err, data) {
                    expect(err).to.be.a("null");
                    expect(data).to.have.property("data");
                    expect(data.data[0]).to.equal(false);
                    expect(data.data[3]).to.equal(true);

                    done();
                });
            });
        });

        describe("#writeFC22() - mask write register", function() {
            it("should mask register 9 from 0xffff to 0x00ff (AND=0x00f0, OR=0x000f)", function(done) {
                modbusRTU.writeFC22(1, 9, 0x00f0, 0x000f, function(err, data) {
                    expect(err).to.be.a("null");

                    expect(data).to.have.property("address", 9);
                    expect(data).to.have.property("andMask", 0x00f0);
                    expect(data).to.have.property("orMask", 0x000f);

                    done();
                });
            });
        });

        describe("#writeFC43() - read device identification", function() {
            it("should return a device identificationm without errors", function(done) {
                modbusRTU.writeFC43(1, 4, 1, function(err, data) {
                    expect(err).to.be.a("null");
                    expect(data.conformityLevel).to.equal(1);
                    expect(data.data["1"]).to.equal("MyProductCode1234");
                    done();
                });
            });
        });

        describe("Timeout", function() {
            const timeout = 1000;
            let clock;
            beforeEach(function() {
                clock = sinon.useFakeTimers();
            });

            afterEach(function() {
                clock.restore();
            });

            it("should time out", function(done) {
                modbusRTU._timeout = timeout;
                modbusRTU.writeFC3(6, 8, 3, function(err) {
                    expect(err.message).to.have.string("Timed out");
                    done();
                });

                clock.tick(timeout);
            });

            describe("Promise", function() {
                it("should reject with error if timeout is hit", function(done) {
                    modbusRTU.setID(6);
                    modbusRTU.setTimeout(timeout);
                    modbusRTU.readCoils(1, 1)
                        .then(function() {
                            done(new Error("Call should timeout"));
                        })
                        .catch(function(err) {
                            expect(err.message).to.have.string("Timed out");
                            done();
                        });

                    clock.tick(timeout);
                });
            });
        });
    });
});
