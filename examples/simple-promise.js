// create an empty modbus client
//var ModbusRTU = require("modbus-serial");
var ModbusRTU = require("../index");
var client = new ModbusRTU();

// open connection to a serial port
client.connectRTU("/dev/ttyUSB0", {baudrate: 9600}, stage1);

// use callback
function stage1() {
    // det client id
    client.setID(1);
    
    // same as using client.writeFC5
    client.writeCoil(13, true, function(err, d) {
        console.log("writeCoil 13: ", d.state);
        stage2();
    });
}

// use promise
function stage2() {
    client.writeCoil(11, true)
        .then(function(d) {
            console.log("writeCoil 11: ", d.state);})
        .then(stage3);
}

// use promise
function stage3() {
    client.readDiscreteInputs(10, 8)
        .then(function(d) {
            console.log("readDiscreteInputs: ", d.data);})
        .then(exit);
}

// exit process
function exit() {
    client._port.close();
    process.exit();
}

