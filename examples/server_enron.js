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
console.log("ModbusTCP listening on modbus://0.0.0.0:8502");
// set the server to answer for modbus requests
const serverTCP = new ModbusRTU.ServerTCP(
    vector,
    {
        host: "0.0.0.0",
        port: 8502,
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

serverTCP.on("error", function(err) {
    // Handle socket error if needed, can be ignored
    console.error(err);
});

serverTCP.on("initialized", function() {
    console.log("initialized");
});

serverTCP.on("socketError", function(err) {
    console.error(err);
    serverTCP.close(closed);
});

function closed() {
    console.log("server closed");
}
