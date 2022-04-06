/* eslint-disable no-console, spaced-comment */

// create an empty modbus client
// let ModbusRTU = require("modbus-serial")
const ModbusRTU = require("../index");
const client = new ModbusRTU();

// open connection to a serial port
// client.connectRTUBuffered("/dev/ttyUSB0", {baudRate: 9600})
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
    client.setTimeout(2000);

    // run program
    run();
}

function run() {
    // write to coil
    client.writeCoils(1, [true, false, true, false, true, true, false, true])
        .then(function(d) {
            console.log("Write to coils", d); })
        .catch(function(e) {
            console.log(e.message); })
        .then(writeCoil);
}

function writeCoil() {
    // write to coil
    client.writeCoil(2, true)
        .then(function(d) {
            console.log("Write true to coil 2", d); })
        .catch(function(e) {
            console.log(e.message); })
        .then(writeDiscreteCoil);
}

function writeDiscreteCoil() {
    // write to coil
    client.writeCoil(10001, true)
        .then(function(d) {
            console.log("Write true to discrete input", d); })
        .catch(function(e) {
            console.log(e.message); })
        .then(writeDiscreteCoils);
}

function writeDiscreteCoils() {
    // write to coil
    client.writeCoils(10002, [true, true, true, true])
        .then(function(d) {
            console.log("Write true to discrete inputs", d); })
        .catch(function(e) {
            console.log(e.message); })
        .then(writeRegisters);
}

function writeRegisters() {
    // write 5 registers statrting at input registers
    client.writeRegisters(1, [100, 90, 80, -200 + 65535, -100 + 65535])
        .then(function(d) {
            console.log("Write 100, 90, 80, -200, -100 to input registers", d); })
        .catch(function(e) {
            console.log(e.message); })
        .then(writeHoldingRegsiters);
}

function writeHoldingRegsiters() {
    // write 5 registers statrting at holding registers
    // negative values (< 0) have to add 65535 for Modbus registers
    client.writeRegisters(10001, [10, 9, 8, -20 + 65535, -10 + 65535])
        .then(function(d) {
            console.log("Write 10, 9, 8, -20, -10 to holding registers", d); })
        .catch(function(e) {
            console.log(e.message); })
        .then(close);
}

function close() {
    client.close();
}
