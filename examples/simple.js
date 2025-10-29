/* eslint-disable no-console, spaced-comment */

// create an empty modbus client
//let ModbusRTU = require("modbus-serial");
const ModbusRTU = require("../index");
const client = new ModbusRTU();

const networkErrors = ["ESOCKETTIMEDOUT", "ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EHOSTUNREACH"];

// open connection to a serial port
//client.connectRTUBuffered("/dev/ttyUSB0", { hupcl: false, dsrdtr: false })
client.connectTCP("127.0.0.1", { port: 8502 })
    .then(setClient)
    .then(function() {
        console.log("Connected"); })
    .catch(function(e) {
        if(e.errno) {
            if(networkErrors.includes(e.errno)) {
                console.log("we have to reconnect");
            }
        }
        console.log(e.message); });

function setClient() {
    // set the client's unit id
    // set a timeout for requests default is null (no timeout)
    client.setID(1);
    client.setTimeout(1000);

    // run program
    readRegisters();
}

function readRegisters() {
    // read the 4 registers starting at address 5
    client.readHoldingRegisters(5, 4)
        .then(function(d) {
            console.log("Receive:", d.data); })
        .catch(function(e) {
            console.log(e.message); })
        .then(readCoils);
}

function readCoils() {
    // read the 4 registers starting at address 5
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
