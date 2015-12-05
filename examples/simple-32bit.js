// create an empty modbus client
//var ModbusRTU = require("modbus-serial");
var ModbusRTU = require("../index");
var client = new ModbusRTU();

// open connection to a serial port
client.connectRTU("/dev/ttyUSB0", {baudrate: 9600}, write);

function write() {
    client.setID(1);
    
    // get msb and lsb of 32bit timestamp
    var timestamp = Math.floor(Date.now() / 1000);
    var msb = timestamp >> 16;
    var lsb = timestamp & 0xffff;
    
    console.log('Write:', timestamp);
    
    client
        .writeRegisters(0, [msb, lsb])
        .then(read);
}

function read() {
    // read the 2 registers starting at address 0
    // on device number 1.
    client
        .readHoldingRegisters(0, 2)
        .then(function(data) {
            // use the data buffer to build one 32 bit int
            // from two 16 bit ints
            var timestamp = data.buffer.readUInt32BE();
            
            console.log('Read: ', timestamp);
        })
        .then(exit);
}

function exit() {
    client._port.close();
    process.exit();
}
