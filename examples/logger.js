/* eslint-disable no-console, spaced-comment */

// create an empty modbus client
//let ModbusRTU = require("modbus-serial");
const ModbusRTU = require("../index");
let client = new ModbusRTU();
let timeoutRunRef = null;
let timeoutConnectRef = null;

const networkErrors = [
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
    client.setTimeout(1000);

    // run program
    run();
}

function run() {
    // clear pending timeouts
    clearTimeout(timeoutRunRef);

    // read the 4 registers starting at address 5
    client.readHoldingRegisters(5, 4)
        .then(function(d) {
            console.log("Receive:", d.data); })
        .then(function() {
            timeoutRunRef = setTimeout(run, 1000); })
        .catch(function(e) {
            checkError(e);
            console.log(e.message); });
}

// connect and start logging
connect();
