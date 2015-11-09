// Create tcp port
//var TcpPort = require("modbus-serial").TcpPort;
var TcpPort = require("../index").TcpPort;
var tcpPort = new TcpPort("192.168.1.42");

// Create modbus
//var ModbusRTU = require("modbus-serial");
var ModbusRTU = require("../index");
var modbusRTU = new ModbusRTU(tcpPort);

// Open modbus communication.
modbusRTU.open();

/* read 10 registers every one second 
 * 1 - The Slave Address.
 * 0 - The Data Address of the first register.
 * 10 - Number of registers to read.
 */
setInterval(function() {
    modbusRTU.writeFC4(1, 0, 10, function(err, data) {
        console.log(data.data);
    });
}, 1000);
