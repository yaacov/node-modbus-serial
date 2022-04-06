/* eslint-disable no-console, spaced-comment */

// create an empty modbus client
//let ModbusRTU = require("modbus-serial");
const ModbusRTU = require("../index");
const client = new ModbusRTU();

// NPort Gateway 801D NetPort
client.connectTcpRTUBuffered("127.0.0.1", { port: 8502 })
    .then(setClient)
    .then(function() {
        console.log("Connected");
    })
    .catch(function(e) {
        console.log(e.message);
    });

function setClient() {
    // set the client's unit id
    // set a timout for requests default is null (no timeout)
    client.setID(1);
    client.setTimeout(2000);

    // run program
    run();
}

function run() {
    // read the 4 registers starting at address 5
    client.readDiscreteInputs(0, 22)
        .then(function(d) {
            console.log("Receive:", d.data);
        })
        .catch(function(e) {
            console.log(e.message);
        })
        .then(close);
}

function close() {
    client.close();
}
