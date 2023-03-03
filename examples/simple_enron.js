/* eslint-disable no-console, spaced-comment */

const ModbusRTU = require("../index");
const client = new ModbusRTU();

const networkErrors = ["ESOCKETTIMEDOUT", "ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EHOSTUNREACH"];

function write() {
    console.log("write");

    // write the values 1234567890 to register 5001
    client
        .writeRegisterEnron(5001, 0x499602d2)
        .then(read)
        .catch(function(e) {
            console.log(e.message);
        });
}

function read() {
    console.log("read");

    // read the 2 registers starting at address 5001
    // on device number 1.
    client.readRegistersEnron(5001, 2)
        .then(console.log)
        .catch(function(e) {
            console.log(e.message);
        })
        .then(close);
}

client.connectTCP(
    "127.0.0.1",
    {
        port: 8502,
        enron: true,
        enronTables: {
            booleanRange: [1001, 1999],
            shortRange: [3001, 3999],
            longRange: [5001, 5999],
            floatRange: [7001, 7999]
        }
    })
    .then(setClient)
    .then(function() {
        console.log("Connected"); })
    .catch(function(e) {
        if(e.errno) {
            if(networkErrors.includes(e.errno)) {
                console.log("we have to reconnect");
            }
        }
        console.log(e.message);
    });

function setClient() {
    // set the client's unit id
    // set a timout for requests default is null (no timeout)
    client.setID(1);
    client.setTimeout(1000);

    // run program
    write();
}

function close() {
    client.close();
}
