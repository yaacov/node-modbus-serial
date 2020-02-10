"use strict";
/* eslint-disable no-undef */

var ModbusRTU = require("../../index");
var TestPort = ModbusRTU.TestPort;
var testPort = new TestPort();
var modbusRTU = new ModbusRTU(testPort);

var expect = require("chai").expect;

describe("Promise", function() {

    describe("Functions", function() {
        it("should bind promise functions on modbusRTU", function() {
            var address = 1;
            var arg = 1;
            var value = 1;
            var deviceIdCode = 1;
            var objectId = 2;

            modbusRTU.open();
            expect(modbusRTU.readCoils(address, arg)).to.be.instanceOf(Promise);
            expect(modbusRTU.readDiscreteInputs(address, arg)).to.be.instanceOf(Promise);
            expect(modbusRTU.readHoldingRegisters(address, arg)).to.be.instanceOf(Promise);
            expect(modbusRTU.readInputRegisters(address, arg)).to.be.instanceOf(Promise);
            expect(modbusRTU.writeCoil(address, value)).to.be.instanceOf(Promise);
            expect(modbusRTU.writeRegister(address, value)).to.be.instanceOf(Promise);
            expect(modbusRTU.writeRegisters(address, [value])).to.be.instanceOf(Promise);
            expect(modbusRTU.readDeviceIdentification(deviceIdCode, objectId)).to.be.instanceOf(Promise);
        });
    });

    describe("#setID", function() {
        it("should set a unit id on modubusRtu instance", function() {
            var someId = 1;
            modbusRTU.setID(someId);
            expect(modbusRTU._unitID).to.be.equal(someId);
        });
    });

    describe("#getID", function() {
        it("should return the unit id of modubusRtu instance", function() {
            var someId = 1;
            modbusRTU._unitID = someId;
            expect(modbusRTU.getID()).to.be.equal(someId);
        });
    });

    describe("#setTimeout", function() {
        it("should set a timeout on modubusRtu instance", function() {
            var timeout = 1000;
            modbusRTU.setTimeout(timeout);
            expect(modbusRTU._timeout).to.be.equal(timeout);
        });
    });

    describe("#getTimeout", function() {
        it("should return the timeout of modubusRtu instance", function() {
            modbusRTU._timeout = 1000;
            expect(modbusRTU.getTimeout()).to.be.equal(modbusRTU._timeout);
        });
    });
});
