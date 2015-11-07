// Create serial port
var SerialPort = require("serialport").SerialPort;
var serialPort = new SerialPort("/dev/ttyUSB0", {baudrate: 9600});

// Create modbus
var ModbusRTU = require("modbusrtu");
var modbusRTU = new ModbusRTU(serialPort);

// Open modbus communication.
modbusRTU.open();

/* Write 2 registers:
 * 1 - The Slave Address.
 * 5 - The Data Address of the first register.
 * [0x1800, 0xffff] - The values to write.
 */
setTimeout(function() {
    modbusRTU.writeFC16(1, 5, [0x1800 , 0xffff]);
}, 1000);

/* read 2 registers:
 * 1 - The Slave Address.
 * 5 - The Data Address of the first register.
 * 2 - Number of registers to read.
 */
setTimeout(function() {
    modbusRTU.writeFC4(1, 5, 2, function(err, data) {
        console.log(data);
    });
}, 2000);

// Close communication.
setTimeout(function() {
    serialPort.close();
}, 3000);
