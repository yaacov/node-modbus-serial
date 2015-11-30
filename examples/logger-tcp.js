// create an empty modbus client
//var ModbusRTU = require("modbus-serial");
var ModbusRTU = require("../index");
var client = new ModbusRTU();

// open connection to a tcp line
client.connectTCP("192.168.1.24");

/* read 10 registers every one second 
 * 1 - The Slave Address.
 * 0 - The Data Address of the first register.
 * 10 - Number of registers to read.
 */
setInterval(function() {
    client.writeFC4(1, 0, 10, function(err, data) {
        console.log(data.data);
    });
}, 1000);
