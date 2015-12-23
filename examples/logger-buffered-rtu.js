// create an empty modbus client
//var ModbusRTU = require("modbus-serial");
var ModbusRTU = require("../index");
var client = new ModbusRTU();

// open connection to a tcp line
client.connectRTUBuffered("/dev/ttyUSB0", {baudrate: 9600}, run);
client.setID(1);

// read the values of 10 registers starting at address 0
// on device number 1. and log the values to the console.
function run() {
    client.readInputRegisters(0, 10)
        .then(console.log)
        .catch(console.log);
    
    setTimeout(run, 1000);
}
