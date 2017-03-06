/* eslint-disable no-console, no-unused-vars, spaced-comment */

// create an empty modbus client
//var ModbusRTU = require("modbus-serial");
var ModbusRTU = require("../index");
var vector = {
    getInputRegister: function(addr) { return addr; },
    getHoldingRegister: function(addr) { return addr + 8000; },
    getCoil: function(addr) { return (addr % 2) === 0; },
    setRegister: function(addr, value) { console.log('set register', addr, value); return; },
    setCoil: function(addr, value) { console.log('set coil', addr, value); return; }
};

// set the server to answer for modbus requests
console.log('ModbusTCP listening on modbus://0.0.0.0:8502');
var serverTCP = new ModbusRTU.ServerTCP(vector, { host: '0.0.0.0', port: 8502, debug: true, unitID: 1 });
