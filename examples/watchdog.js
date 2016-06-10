// create an empty modbus client
//var ModbusRTU = require("modbus-serial");
var ModbusRTU = require("../index");
var client = new ModbusRTU();

// open connection to a tcp line
client.connectTCP("192.168.1.115", run);

// read 8 read holding registers starting at register 10
// (function use the unit id 1, we set earlier)
function run() {
  // set unit id
  client.setID(1);

  // set a timout for requests default is null (no timeout)
  client.setTimeout(1000);

  client.readHoldingRegisters(10, 8)
    .then(function(data) {
      // we got an answer before watchdog timeout
      console.log(data);
    })
    .catch(function (err) {
      // watchdog was trigered
      console.log(err);
    });
}
