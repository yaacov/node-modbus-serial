/* eslint-disable no-console, spaced-comment */

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
    // write to coil
    client.writeCoil(5, true)
        .then(function(d) {
            console.log("Write true to coil 5", d); })
        .catch(function(e) {
            console.log(e.message); })
        .then(writeRegisters);
}

function writeRegisters() {
    // write 3 registers statrting at register 101
    // negative values (< 0) have to add 65535 for Modbus registers
    client.writeRegisters(101, [10, 9, 8, -20 + 65535, -10 + 65535])
        .then(function(d) {
            console.log("Write 10, 9, 8, -20, -10 to registers 101 to 105", d); })
        .catch(function(e) {
            console.log(e.message); })
        .then(close);
}

function close() {
    client.close();
}
