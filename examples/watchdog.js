// create an empty modbus client
//var ModbusRTU = require("modbus-serial");
var ModbusRTU = require("../index");
var client = new ModbusRTU();

// open connection to a tcp line
client.connectTCP("192.168.1.115");

// the global last_connection time for the watchdog
var last_connection = new Date();

/* check time of last_connection and restart-reading if needed
 */
var watchdog = function() {
    var time_diff = new Date() - last_connection;
    if (time_diff > 1000) {
        console.log('Oyyy ... we did not get data for 1 sec, will try again.');
        run();
    }
}

/* if last request was good - send a read request evry 0.5 sec
 * and update last_connection
 */
var run = function() {
    console.log('Send a request for input registers.');
    client.readInputRegisters(0, 10, function(err, data) {
        if (!err) {
          console.log(data.data);
          last_connection = new Date();

          setTimeout(run, 500);
        }
    });
}

/* run the watchdog
 */
setInterval(function() {
    watchdog();
}, 500);

