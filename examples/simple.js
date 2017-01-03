// create an empty modbus client
//var ModbusRTU = require("modbus-serial");
var ModbusRTU = require("../index");
var client = new ModbusRTU();

// open connection to a serial port
//client.connectRTU("/dev/ttyUSB0", {baudrate: 9600})
client.connectTCP("192.168.1.25")
  .then(read)
  .then(function() {
    console.log("Connected"); })
  .catch(function(e) {
    console.log(e.message); });

function read() {
  // read the 4 registers starting at address 5
  client.readHoldingRegisters(5, 4)
    .then(function(d) {
      console.log("Recive:", d.data); })
    .catch(function(e) {
      console.log(e.message); })
    .then(close);
}

function close() {
  client.close();
}
