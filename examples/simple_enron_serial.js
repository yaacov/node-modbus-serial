/* eslint-disable no-console, spaced-comment */

// create an empty modbus client
const ModbusRTU = require("../index");
const client = new ModbusRTU();

// open connection to a serial port
client.connectRTU(
    "/tmp/ptyp0",
    {
        baudRate: 9600,
        debug: true,
        enron: true,
        enronTables: {
            booleanRange: [1001, 1999],
            shortRange: [3001, 3999],
            longRange: [5001, 5999],
            floatRange: [7001, 7999]
        }
    }
)
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
    writeRegisters();
}

function writeRegisters() {
    // write to register 5001
    client.writeRegisterEnron(5001, 1234567890)
        .then(function(d) {
            console.log("Write:", d);
        })
        .catch(function(e) {
            console.log(e.message); })
        .then(readRegisters);
}

function readRegisters() {
    // read the 1 registers starting at address 5001
    client.readRegistersEnron(5001, 1)
        .then(function(d) {
            console.log("Receive:", d.data); })
        .catch(function(e) {
            console.log(e.message); })
        .then(writeCoils);
}

function writeCoils() {
    // write true to coil #1
    client.writeCoil(1, true)
        .then(function(d) {
            console.log("Write:", d);
        })
        .catch(function(e) {
            console.log(e.message); })
        .then(readCoils);
}

function readCoils() {
    // read the 20 coils
    client.readCoils(1, 20)
        .then(function(d) {
            console.log("Receive:", d.data); })
        .catch(function(e) {
            console.log(e.message); })
        .then(close);
}

function close() {
    client.close();
}
