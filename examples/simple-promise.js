'use strict';
// Create serial port
var SerialPort = require("serialport").SerialPort;
var serialPort = new SerialPort("/dev/ttyUSB0", {baudrate: 9600});

// Create modbus master
//var ModbusRTU = require("modbus-serial");
var ModbusRTU = require("../index");
var client = new ModbusRTU(serialPort);

// Open modbus communication.
// and set the client unit id to 1
client.setID(1);
client.open(stage1);

// use callback, if function get a callback it
// will not return a promise
function stage1() {
    // same as using client.writeFC5
    client.writeCoil(13, false, function(err, d) {
        console.log("writeCoil: ", d.state);
        stage2();
    });
}

// use promise 1
function stage2() {
    client.writeCoil(11, true)
        .then(function(d) {
            console.log("writeCoil: ", d.state);})
        .then(stage3);
}

// use promise 2
function stage3() {
    client.readDiscreteInputs(10, 8)
        .then(function(d) {
            console.log("readDiscreteInputs: ", d.data);})
        .then(end);
}

function end() {
    serialPort.close();
}

