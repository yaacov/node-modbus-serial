// Create serial port
var SerialPort = require("serialport").SerialPort;
var serialPort = new SerialPort("/dev/ttyUSB0", {baudrate: 9600});

// Create modbus master
//var ModbusRTU = require("modbus-serial");
var ModbusRTU = require("../index");
var modbusRTU = new ModbusRTU(serialPort);

// Open modbus communication.
modbusRTU.open();

/* read 2 16bit registers to get one 32bit value:
 * 1 - The Slave Address.
 * 2 - The Data Address of the first register.
 * 2 - Number of registers to read.
 */
setTimeout(function() {
    modbusRTU.writeFC4(1, 5, 2, function(err, data) {
        console.log(data.buffer.readUInt32BE());
    });
}, 500);

/* Write one 32bit value as two 16bit registers:
 * 1 - The Slave Address.
 * 0 - The Data Address of the first register.
 * 32bit timestamp into two 16bit uint registers.
 */
setTimeout(function() {
    var timestamp = Math.floor(Date.now() / 1000);
    var msb = timestamp >> 16;
    var lsb = timestamp & 0xffff;
    
    modbusRTU.writeFC16(1, 0, [msb, lsb]);
}, 1000);

// Close communication.
setTimeout(function() {
    serialPort.close();
}, 2000);
