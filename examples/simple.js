// create an empty modbus client
//var ModbusRTU = require("modbus-serial");
var ModbusRTU = require("../index");
var client = new ModbusRTU();

// open connection to a serial port
client.connectRTU("/dev/ttyUSB0", {baudrate: 9600}, write);

function write() {
    var data = [0 , 0xffff];
    
    client.setID(1);
    console.log("Send:  ", data);
    
    // write the values 0, 0xffff to registers starting at address 5
    // on device number 1.
    client.writeRegisters(5, data)
        .then( read );
}

function read() {
    // read the 2 registers starting at address 5
    // on device number 1.
    client.readHoldingRegisters(5, 2)
        .then( function(d) {
            console.log("Recive:", d); })
        .then( exit );
}

function exit() {
    client._port.close();
    process.exit();
}

