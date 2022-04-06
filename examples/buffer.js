/* eslint-disable no-console, spaced-comment */

// create an empty modbus client
//let ModbusRTU = require("modbus-serial");
const ModbusRTU = require("../index");
const client = new ModbusRTU();

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
    client.readInputRegisters(4, 12)
        .then(function(d) {
            const floatA = d.buffer.readFloatBE(0);
            const floatB = d.buffer.readFloatBE(4);
            const floatC = d.buffer.readFloatBE(8);
            console.log("Receive:", floatA, floatB, floatC); })
        .catch(function(e) {
            console.log(e.message); })
        .then(close);
}

function close() {
    client.close();
}
