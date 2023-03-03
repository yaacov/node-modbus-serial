/* eslint-disable no-console, no-unused-vars, spaced-comment */

const ModbusRTU = require("../index");
const holdingRegisters = {};
const coils = {};
const inputRegisters = {};
const discreteInputs = {};

const vector = {
    getInputRegister: function(addr) {
        return inputRegisters[addr];
    },
    getMultipleInputRegisters: function(startAddr, length) {
        const values = [];
        for (let i = 0; i < length; i++) {
            values[i] = inputRegisters[startAddr + i];
        }
        return values;
    },
    getDiscreteInput: function(addr) {
        return discreteInputs[addr];
    },
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
    },
    getCoil: function(addr) {
        return coils[addr];
    },
    setCoil: function(addr, value) {
        coils[addr] = value;
        return coils[addr];
    },
    readDeviceIdentification: function() {
        return {
            0x00: "MyVendorName",
            0x01: "MyProductCode",
            0x02: "MyMajorMinorRevision",
            0x05: "MyModelName",
            0x97: "MyExtendedObject1",
            0xab: "MyExtendedObject2"
        };
    }
};

// set the server to answer for modbus requests
const serverSerial = new ModbusRTU.ServerSerial(
    vector,
    {
        port: "/tmp/ttyp0",
        baudRate: 9600,
        debug: true,
        unitID: 1,
        enron: true,
        enronTables: {
            booleanRange: [1001, 1999],
            shortRange: [3001, 3999],
            longRange: [5001, 5999],
            floatRange: [7001, 7999]
        }
    }
);

serverSerial.on("error", function(err) {
    // Handle socket error if needed, can be ignored
    console.error(err);
});

serverSerial.on("initialized", function() {
    console.log("initialized");
});

serverSerial.on("socketError", function(err) {
    console.error(err);
    serverSerial.close(closed);
});

function closed() {
    console.log("server closed");
}
