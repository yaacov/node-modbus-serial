"use strict";

const expect = require("chai").expect;
const mockery = require("mockery");

const LONG_MSG = "010380018301830183018301830183018301830183018301830183018301830\
1830183018301830183018301830183018301830183018301830183018301830183018301830183\
0183018301830183018301830183018301830183018301830183018301830183018301830183018\
3018301830183018301830183018301830183018346e0";

// FC 43 basic device identification of unit 0x11 ("HUAWEI", "SUN2000", "V100R") and FC 17 report server id
const FC43_REQUEST = "112b0e0100b1b4";
const FC43_RESPONSE = "112b0e01010000030006485541574549010753554e323030300205563130305277dd";
const FC43_EXCEPTION = "11ab019f35";
const FC17_REQUEST = "1111cdec";
const FC17_RESPONSE = "11110501020304ff0f67";

const receiveBytewise = function(client, hex) {
    for (let i = 0; i < hex.length; i += 2) {
        client.receive(Buffer.from(hex.slice(i, i + 2), "hex"));
    }
};

describe("Modbus Telnet port", function() {
    let port;

    before(function() {
        const mock = require("./../mocks/netMock");
        mockery.resetCache();
        mockery.enable({ warnOnReplace: false, useCleanCache: true, warnOnUnregistered: false });
        mockery.registerMock("net", mock);
        const TelnetPort = require("./../../ports/telnetport");
        port = new TelnetPort("127.0.0.1", { port: 9999 });
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
        it("should not be closed on timeout", function(done) {
            port.open(function() {
                expect(port.isOpen).to.be.true;
                port.emit("timeout");
                expect(port.isOpen).to.be.true;
                done();
            });
        });
    });

    describe("data handler", function() {
        it("should return a valid Modbus RTU message", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("110306ae415652434049ad");
                done();
            });
            port.open(function() {
                port.write(Buffer.from("1103006B00037687", "hex"));
                setTimeout(function() {
                    port._client.receive(Buffer.from("11", "hex"));
                    port._client.receive(Buffer.from("03", "hex"));
                    port._client.receive(Buffer.from("06", "hex"));
                    port._client.receive(Buffer.from("ae", "hex"));
                    port._client.receive(Buffer.from("41", "hex"));
                    port._client.receive(Buffer.from("56", "hex"));
                    port._client.receive(Buffer.from("52", "hex"));
                    port._client.receive(Buffer.from("43", "hex"));
                    port._client.receive(Buffer.from("40", "hex"));
                    port._client.receive(Buffer.from("49", "hex"));
                    port._client.receive(Buffer.from("ad", "hex"));
                });
            });
        });

        it("should return a valid Modbus RTU exception", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("1183044136");
                done();
            });
            port.open(function() {
                port.write(Buffer.from("1103006B00037687", "hex"));
                setTimeout(function() {
                    port._client.receive(Buffer.from("11", "hex"));
                    port._client.receive(Buffer.from("83", "hex"));
                    port._client.receive(Buffer.from("04", "hex"));
                    port._client.receive(Buffer.from("41", "hex"));
                    port._client.receive(Buffer.from("36", "hex"));
                });
            });
        });

        it("Special data package, should return a valid Modbus RTU message", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal(LONG_MSG);
                done();
            });
            port.open(function() {
                port.write(Buffer.from("010300000040443A", "hex"));
                setTimeout(function() {
                    for (let i = 0; i < LONG_MSG.length; i += 2) {
                        port._client.receive(Buffer.from(LONG_MSG.slice(i, i + 2), "hex"));
                    }
                });
            });
        });

        it("Illegal start chars, should synchronize to valid Modbus RTU message", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("110306ae415652434049ad");
                done();
            });
            port.open(function() {
                port.write(Buffer.from("1103006B00037687", "hex"));
                setTimeout(function() {
                    port._client.receive(Buffer.from("20", "hex")); // illegal char
                    port._client.receive(Buffer.from("54", "hex")); // illegal char
                    port._client.receive(Buffer.from("54", "hex")); // illegal char
                    port._client.receive(Buffer.from("ff", "hex")); // illegal char
                    port._client.receive(Buffer.from("11", "hex"));
                    port._client.receive(Buffer.from("03", "hex"));
                    port._client.receive(Buffer.from("06", "hex"));
                    port._client.receive(Buffer.from("ae", "hex"));
                    port._client.receive(Buffer.from("41", "hex"));
                    port._client.receive(Buffer.from("56", "hex"));
                    port._client.receive(Buffer.from("52", "hex"));
                    port._client.receive(Buffer.from("43", "hex"));
                    port._client.receive(Buffer.from("40", "hex"));
                    port._client.receive(Buffer.from("49", "hex"));
                    port._client.receive(Buffer.from("ad", "hex"));
                });
            });
        });
        it("Illegal end chars, should return a valid Modbus RTU message", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("110306ae415652434049ad");
                done();
            });
            port.open(function() {
                port.write(Buffer.from("1103006B00037687", "hex"));
                setTimeout(function() {
                    port._client.receive(Buffer.from("11", "hex"));
                    port._client.receive(Buffer.from("03", "hex"));
                    port._client.receive(Buffer.from("06", "hex"));
                    port._client.receive(Buffer.from("ae", "hex"));
                    port._client.receive(Buffer.from("41", "hex"));
                    port._client.receive(Buffer.from("56", "hex"));
                    port._client.receive(Buffer.from("52", "hex"));
                    port._client.receive(Buffer.from("43", "hex"));
                    port._client.receive(Buffer.from("40", "hex"));
                    port._client.receive(Buffer.from("49", "hex"));
                    port._client.receive(Buffer.from("ad", "hex"));
                    port._client.receive(Buffer.from("20", "hex")); // illegal char
                    port._client.receive(Buffer.from("54", "hex")); // illegal char
                    port._client.receive(Buffer.from("54", "hex")); // illegal char
                    port._client.receive(Buffer.from("ff", "hex")); // illegal char
                });
            });
        });

        it("should return a valid Modbus RTU message on illegal chars", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("110306ae415652434049ad");
                done();
            });
            port.open(function() {
                port.write(Buffer.from("1103006B00037687", "hex"));
                setTimeout(function() {
                    port._client.receive(Buffer.from("11", "hex"));
                    port._client.receive(Buffer.from("03", "hex"));
                    port._client.receive(Buffer.from("06", "hex"));
                    port._client.receive(Buffer.from("ae", "hex"));
                    port._client.receive(Buffer.from("41", "hex"));
                    port._client.receive(Buffer.from("56", "hex"));
                    port._client.receive(Buffer.from("52", "hex"));
                    port._client.receive(Buffer.from("43", "hex"));
                    port._client.receive(Buffer.from("40", "hex"));
                    port._client.receive(Buffer.from("49", "hex"));
                    port._client.receive(Buffer.from("ad", "hex"));
                });
            });
        });
    });

    describe("data handler, function codes with variable length", function() {
        it("should return a complete FC 43 Read Device Identification response", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal(FC43_RESPONSE);
                done();
            });
            port.open(function() {
                port.write(Buffer.from(FC43_REQUEST, "hex"));
                setTimeout(function() {
                    receiveBytewise(port._client, FC43_RESPONSE);
                });
            });
        });

        it("should return a complete FC 43 response after illegal start chars", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal(FC43_RESPONSE);
                done();
            });
            port.open(function() {
                port.write(Buffer.from(FC43_REQUEST, "hex"));
                setTimeout(function() {
                    receiveBytewise(port._client, "2054ff" + FC43_RESPONSE);
                });
            });
        });

        it("should return a FC 43 exception", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal(FC43_EXCEPTION);
                done();
            });
            port.open(function() {
                port.write(Buffer.from(FC43_REQUEST, "hex"));
                setTimeout(function() {
                    receiveBytewise(port._client, FC43_EXCEPTION);
                });
            });
        });

        it("should return a complete FC 17 Report Server ID response", function(done) {
            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal(FC17_RESPONSE);
                done();
            });
            port.open(function() {
                port.write(Buffer.from(FC17_REQUEST, "hex"));
                setTimeout(function() {
                    receiveBytewise(port._client, FC17_RESPONSE);
                });
            });
        });
    });

    describe("#write", function() {
        it("should write a valid RTU message to the port", function() {
            port.write(Buffer.from("1103006B00037687", "hex"));
            expect(port._client._data.toString("hex")).to.equal("1103006b00037687");
        });

        it("should write a 4 byte FC 17 request to the port", function() {
            port.write(Buffer.from(FC17_REQUEST, "hex"));
            expect(port._client._data.toString("hex")).to.equal(FC17_REQUEST);
        });

        it("should reject a FC 1-4 request shorter than 6 bytes without touching the pending request", function() {
            port.write(Buffer.from("1103006B00037687", "hex"));
            for (const shortRequest of ["12010000", "1202000000", "12030000", "1204000000"]) {
                expect(function() {
                    port.write(Buffer.from(shortRequest, "hex"));
                }).to.not.throw();
            }
            expect(port._client._data.toString("hex")).to.equal("1103006b00037687");
            expect(port._id).to.equal(0x11);
            expect(port._cmd).to.equal(3);
        });
    });
});
