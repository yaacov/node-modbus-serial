// create an empty modbus client
//var ModbusRTU = require("modbus-serial");
var ModbusRTU = require("../index");
var client = new ModbusRTU();

// open connection to a serial port
//client.connectRTU("/dev/ttyUSB0", {baudrate: 9600})
client.connectTCP("10.205.1.42")
    .then(setClient)
    .then(function() {
        console.log("Connected"); })
    .catch(function(e) {
        console.log(e.message); });

function setClient() {
    // set the client's unit id
    // set a timout for requests default is null (no timeout)
    client.setID(1);
    client.setTimeout(1000);

    // run program
    run();
}

function run() {
    // read the 4 registers starting at address 5
    client.readInputRegisters(4, 12)
      .then(function(d) {
          floatA = d.buffer.readFloatBE(0);
          floatB = d.buffer.readFloatBE(4);
          floatC = d.buffer.readFloatBE(8);
          console.log("Receive:", floatA, floatB, floatC); })
      .catch(function(e) {
          console.log(e.message); })
      .then(close);
}

function close() {
    client.close();
}
