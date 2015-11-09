// Create serial port
var SerialPort = require("serialport").SerialPort;
var serialPort = new SerialPort("/dev/ttyUSB0", {baudrate: 9600});

// Create modbus
//var ModbusRTU = require("modbus-serial");
var ModbusRTU = require("../index");
var modbusRTU = new ModbusRTU(serialPort);

// Open modbus communication.
modbusRTU.open();

/* read 2 16bit registers to get one 32 bit number:
 * 1 - The Slave Address.
 * 2 - The Data Address of the first register.
 * 2 - Number of registers to read.
 */
setTimeout(function() {
    modbusRTU.writeFC4(1, 5, 2, function(err, data) {
        console.log(data.buffer.readUInt32BE());
    });
}, 2000);

// Close communication.
setTimeout(function() {
    serialPort.close();
}, 3000);
