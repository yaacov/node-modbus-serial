// create an empty modbus client
//var ModbusRTU = require("modbus-serial");
var ModbusRTU = require("../index");
var client = new ModbusRTU();

// open connection to a C701 UDP-to-Serial bridge
client.connectC701("2.55.72.186", {"port": 28674}, run);
client.setID(1);

setInterval(run, 1000);

// read the values of 6 registers (12 bytes) starting at address 2
// on device number 1.and log the buffer as floats (4 bytes each) 
// to the console.
function run() {
    client.readInputRegisters(2, 6)
        .then(printFloats)
        .catch(console.log);
}

// print out the buffer as floats
function printFloats(data) {
    var ans = [];
    
    // get data as 4 byte floats from the raw buffer data
    for (var i = 0; i < data.buffer.length; i += 4) {
        ans.push(data.buffer.readFloatBE(i));
    }
    
    // print the floats
    console.log(ans);
}
