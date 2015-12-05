// Create serial port
var SerialPort = require("serialport").SerialPort;
var serialPort = new SerialPort("/dev/ttyUSB0", {baudrate: 9600});

// Create modbus master
//var ModbusRTU = require("modbus-serial");
var ModbusRTU = require("../index");
var client = new ModbusRTU(serialPort);

/* Write coil:
 * 1 - The Slave Address.
 * 11 - The Data Address of the coil.
 * false - The values to write.
 */
function stage1() {
    client.writeFC5(1, 11, true);
};

function stage2() {
    client.writeFC5(1, 12, true);
};

/* read discreet inputs:
 * 1 - The Slave Address.
 * 10 - The Data Address of the first input.
 * 8 - Number of inputs to read.
 */
function stage3() {
    client.writeFC1(1, 10, 8, function(err, d) {
        d.data.forEach(function(e, i) {
            console.log(i + 10, e);
        });
    });
};

/* exit process
 */
function exit() {
    client._port.close();
    process.exit();
}

// Open modbus communication.
client.open();

// call the program stages using timeouts
setTimeout(stage1,  250);
setTimeout(stage2,  500);
setTimeout(stage3, 1250);
setTimeout(exit,   1500);
