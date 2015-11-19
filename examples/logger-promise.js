// create an empty modbus client
var ModbusRTU = require("modbus-serial");
var client = new ModbusRTU();

// open connection to a tcp line
client.connectTCP("192.168.1.42", run);
client.setID(1);

// read the values of 10 registers starting at address 0
// on device number 1. and log the values to the console.
function run() {
    client.readInputRegisters(0, 10)
        .then(console.lot)
        .then(run);
}
