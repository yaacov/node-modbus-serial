// create an empty modbus client
//var ModbusRTU = require("modbus-serial");
var ModbusRTU = require("../index");
var client = new ModbusRTU();

// open connection to a telnet server
client.connectTelnet("127.0.0.1");

client.setID(1);
setInterval(run, 1000);

// read the values of 10 registers starting at address 0
// on device number 1. and log the values to the console.
function run() {
    client.readInputRegisters(0, 10)
        .then(console.log);
}

