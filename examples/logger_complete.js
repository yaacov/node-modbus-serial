/* eslint-disable no-console, spaced-comment */

// create an empty modbus client
//var ModbusRTU = require("modbus-serial");
var ModbusRTU = require("../index");
var client = new ModbusRTU();
var timeoutRunRefCoils = null;
var timeoutRunRefDiscreteInputs = null;
var timeoutRunRefInputs = null;
var timeoutRunRefHoldings = null;
var timeoutConnectRef = null;

var networkErrors = [
    "ESOCKETTIMEDOUT",
    "ETIMEDOUT",
    "ECONNRESET",
    "ECONNREFUSED",
    "EHOSTUNREACH",
    "ENETRESET",
    "ECONNABORTED",
    "ENETUNREACH",
    "ENOTCONN",
    "ESHUTDOWN",
    "EHOSTDOWN",
    "ENETDOWN",
    "EWOULDBLOCK",
    "EAGAIN"
];


// check error, and reconnect if needed
function checkError(e) {
    if(e.errno && networkErrors.includes(e.errno)) {
        console.log("we have to reconnect");

        // close port
        client.close();

        // re open client
        client = new ModbusRTU();
        timeoutConnectRef = setTimeout(connect, 1000);
    }
}

// open connection to a serial port
function connect() {
    // clear pending timeouts
    clearTimeout(timeoutConnectRef);

    // if client already open, just run
    if (client.isOpen) {
        run();
    }

    // if client closed, open a new connection
    client.connectTCP("127.0.0.1", { port: 8502 })
        .then(setClient)
        .then(function() {
            console.log("Connected"); })
        .catch(function(e) {
            checkError(e);
            console.log(e.message); });
}

function setClient() {
    // set the client's unit id
    // set a timout for requests default is null (no timeout)
    client.setID(1);
    client.setTimeout(3000);

    // run program
    run();
}

function run() {
    // clear pending timeouts
    clearTimeout(timeoutRunRefCoils);

    client.readCoils(1, 5)
        .then(function(d) {
            console.log("Receive Coils:", d.data); })
        .then(function() {
            timeoutRunRefCoils = setTimeout(readDiscreteInputs, 1000);
        })
        .catch(function(e) {
            checkError(e);
            console.log(e.message); });
}

function readDiscreteInputs() {
    clearTimeout(timeoutRunRefDiscreteInputs);

    client.readDiscreteInputs(10001, 5)
        .then(function(d) {
            console.log("Receive Discrete Inputs:", d.data); })
        .then(function() {
            timeoutRunRefDiscreteInputs = setTimeout(readInputRegisters, 1000); })
        .catch(function(e) {
            checkError(e);
            console.log(e.message); });
}

function readInputRegisters() {
    clearTimeout(timeoutRunRefInputs);

    client.readInputRegisters(1, 5)
        .then(function(d) {
            console.log("Receive Inputs:", d.data); })
        .then(function() {
            timeoutRunRefInputs = setTimeout(readHoldingRegisters, 1000); })
        .catch(function(e) {
            checkError(e);
            console.log(e.message); });
}

function readHoldingRegisters() {
    clearTimeout(timeoutRunRefHoldings);

    client.readHoldingRegisters(10001, 5)
        .then(function(d) {
            console.log("Receive Holding Registers:", d.data); })
        .then(function() {
            timeoutRunRefHoldings = setTimeout(run, 1000); })
        .catch(function(e) {
            checkError(e);
            console.log(e.message);
        });
}

// connect and start logging
connect();
