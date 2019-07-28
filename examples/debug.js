/* eslint-disable no-console, spaced-comment */

/* DEBUG environment variable is used to enable debug logging

  Set the DEBUG variable to be "modbus-serial" before running this example:
  export DEBUG=modbus-serial

  To stop debugging, unset the DEBUG variable:
  unset DEBUG
 */

// create an empty modbus client
//var ModbusRTU = require("modbus-serial");
var ModbusRTU = require("../index");
var client = new ModbusRTU();

// open connection to a serial port
//client.connectRTUBuffered("/dev/ttyUSB0", {baudRate: 9600})
client.connectTCP("127.0.0.1", { port: 8502 })
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
    client.readHoldingRegisters(5, 4)
        .then(function(d) {
            console.log("Receive:", d.data); })
        .catch(function(e) {
            console.log(e.message); })
        .then(close);
}

function close() {
    client.close();
}
