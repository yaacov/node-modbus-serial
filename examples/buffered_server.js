/* eslint-disable no-console, no-unused-vars, spaced-comment */

// create an empty modbus client
//let ModbusRTU = require("modbus-serial");
const ModbusRTU = require("../index");

const coils = Buffer.alloc(160008, 0); // coils and discrete inputs
const regsiters = Buffer.alloc(160008, 0); // input and holding registers

const unitId = 1;
const minAddress = 0;
const maxInputAddress = 10001;
const maxAddress = 20001;
const bufferFactor = 8;

//     1...10000*  address - 1      Coils (outputs)    0   Read/Write
// 10001...20000*  address - 10001  Discrete Inputs    01  Read
// 30001...40000*  address - 30001  Input Registers    04  Read
// 40001...50000*  address - 40001  Holding Registers  03  Read/Write

const vector = {
    getCoil: function(addr, unitID) { if (unitID === unitId && addr >= minAddress && addr < maxAddress) { return coils.readUInt8(addr * bufferFactor); } },
    getInputRegister: function(addr, unitID) { if (unitID === unitId && addr >= minAddress && addr < maxInputAddress) { return regsiters.readUInt16BE(addr * bufferFactor); } },
    getHoldingRegister: function(addr, unitID) { if (unitID === unitId && addr >= maxInputAddress && addr < maxAddress) { return regsiters.readUInt16BE(addr * bufferFactor); } },

    setCoil: function(addr, value, unitID) { if (unitID === unitId && addr >= minAddress && addr < maxAddress) { coils.writeUInt8(value, addr * bufferFactor); } },
    setRegister: function(addr, value, unitID) { if (unitID === unitId && addr >= minAddress && addr < maxAddress) { regsiters.writeUInt16BE(value, addr * bufferFactor); } }
};

// set the server to answer for modbus requests
console.log("ModbusTCP listening on modbus://0.0.0.0:8502");
const serverTCP = new ModbusRTU.ServerTCP(vector, { host: "0.0.0.0", port: 8502, debug: true, unitID: 1 });

serverTCP.on("socketError", function(err) {
    console.error(err);
    serverTCP.close(closed);
});

function closed() {
    console.log("server closed");
}
