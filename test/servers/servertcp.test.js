"use strict";
/* eslint-disable no-undef */

var expect = require("chai").expect;
var net = require("net");

describe("Modbus TCP Server", function() {
    var serverTCP;
    var sock;

    before(function() {
        var TcpServer = require("./../../servers/servertcp");
        var vector = {
            getInputRegister: function(addr) { return addr; },
            getHoldingRegister: function(addr) { return addr + 8000; },
            getCoil: function(addr) { return (addr % 2) === 0; },
            setRegister: function(addr, value) { console.log("set register", addr, value); return; },
            setCoil: function(addr, value) { console.log("set coil", addr, value); return; }
        };
        serverTCP = new TcpServer(vector, { host: "0.0.0.0", port: 8512, debug: true, unitID: 1 });
    });

    after(function() {
        serverTCP = null;
    });

    beforeEach(function () {
        sock = new net.Socket();
    });

    afterEach(function () {
        sock.end();
    });

    describe("function code handler", function() {
        it("should receive a valid Modbus TCP message", function(done) {
            const client = net.connect({host: "0.0.0.0", port: 8512}, () => {
                client.write(new Buffer("0002000000061103006b0003", "hex"));
            });

            client.once("data", function(data) {
                expect(data.toString("hex")).to.equal("000200000006110366778899"); // TODO: should fit tcpport.test?
                done();
            });
        });

        // TODO: FC1 - FCX tests
    });

    describe("modbus exception handler", function() {
        it("should receive a valid Modbus TCP message", function(done) {
            const client = net.connect({host: "0.0.0.0", port: 8512}, () => {
                client.write(new Buffer("0001000000061103006B0003", "hex"));
            });

            client.once("data", function(data) {
                expect(data.toString("hex")).to.equal("000100000005118304"); // TODO: should fit tcpport.test?
                done();
            });
        });

        // TODO: exceptions
    });
});
