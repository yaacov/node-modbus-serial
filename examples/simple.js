// Create serial port
var SerialPort = require("serialport").SerialPort;
var serialPort = new SerialPort("/dev/ttyUSB0", {baudrate: 9600});

// Create modbus master
//var ModbusRTU = require("modbus-serial");
var ModbusRTU = require("../index");
var modbusRTU = new ModbusRTU(serialPort);

// Open modbus communication.
modbusRTU.open();

/* Write 3 16bit registers:
 * 1 - The Slave Address.
 * 5 - The Data Address of the first register.
 * [0x0800, 0x0000, 0x1800] - The values to write.
 */
setTimeout(function() {
    modbusRTU.writeFC16(1, 5, [0x0800, 0x0000, 0x1800]);
}, 500);

/* read 2 16bit registers:
 * 1 - The Slave Address.
 * 5 - The Data Address of the first register.
 * 2 - Number of registers to read.
 */
setTimeout(function() {
    modbusRTU.writeFC4(1, 5, 2, function(err, data) {
        console.log(data);
    });
}, 1500);

// Close communication.
setTimeout(function() {
    serialPort.close();
}, 2000);
