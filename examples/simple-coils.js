// Create serial port
var SerialPort = require("serialport").SerialPort;
var serialPort = new SerialPort("/dev/ttyUSB0", {baudrate: 9600});

// Create modbus master
//var ModbusRTU = require("modbus-serial");
var ModbusRTU = require("../index");
var modbusRTU = new ModbusRTU(serialPort);

// Open modbus communication.
modbusRTU.open();

/* Write coil:
 * 1 - The Slave Address.
 * 11 - The Data Address of the coil.
 * false - The values to write.
 */
setTimeout(function() {
    modbusRTU.writeFC5(1, 11, false);
}, 500);

/* read coils:
 * 1 - The Slave Address.
 * 5 - The Data Address of the first coil.
 * 2 - Number of registers to read.
 */
setTimeout(function() {
    modbusRTU.writeFC1(1, 5, 2, function(err, data) {
        console.log(data);
    });
}, 1000);

// Close communication.
setTimeout(function() {
    serialPort.close();
}, 2000);
