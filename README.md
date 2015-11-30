# modbus-serial
A pure JavaScript implemetation of MODBUS-RTU (and TCP) for NodeJS

[![NPM Version](https://img.shields.io/npm/v/gm.svg?style=flat)](https://www.npmjs.com/package/modbus-serial)

This class makes ModbusRTU (and TCP) calls fun and easy.

Modbus is a serial communications protocol, first used in 1979.
Modbus is simple and robust, openly published, royalty-free and 
easy to deploy and maintain.

- [modbus-serial](#modbus-serial)
      - [Install](#install)
      - [What can I do with this module ?](#what-can-i-do-with-this-module-)
      - [Compatibility](#compatibility)
      - [Examples](#examples)
      - [Methods](#methods)
            - [API Promises](#api-promises)
            - [API](#api)
            - [API connection shorthand](#api-connection-shorthand)

#### Install

```
npm install modbus-serial
```

###### Requires
```
    node-serialport - for using the serial port*

    For use over serial port (ModbusRTU), also install node-serialport:

    npm install serialport

    [ TCP/IP connection does not require the node-serialport package. ]
```
#### What can I do with this module ?

This class makes it fun and easy to communicate with electronic
devices such as irrigation controllers, protocol droids and robots.
It talks with devices that use a serial line (e.g. RS485, RS232).
Many industrial electronic devices implement modbus.
Arduino can also talk modbus and you can control your projects and robots
using modbus. 

Arduino libraries for modbus slave:
* https://github.com/yaacov/arduino-modbus-slave
* https://github.com/smarmengol/Modbus-Master-Slave-for-Arduino
    
Arduino sketch for irrigation timer with modbus support:
* https://github.com/yaacov/arduino-irrigation-timer
    
Node Modbus-WebSocket bridge:
* https://github.com/yaacov/node-modbus-ws
    
#### Compatibility

###### This class implements:

* FC1 "Read Coil Status"
* FC2 "Read Input Status"
* FC3 "Read Holding Registers"
* FC4 "Read Input Registers"
* FC5 "Force Single Coil"
* FC16 "Preset Multiple Registers"

#### Examples
----
###### Logger
``` javascript
// create an empty modbus client
var ModbusRTU = require("modbus-serial");
var client = new ModbusRTU();

// open connection to a tcp line
client.connectTCP("192.168.1.42", run);

// read the values of 10 registers starting at address 0
// on device number 1. and log the values to the console.
function run() {
    client.setID(1);
    
    client.readInputRegisters(0, 10)
        .then(console.log)
        .then(run);
}
```

----
###### Read and Write
``` javascript
// create an empty modbus client
var ModbusRTU = require("modbus-serial");
var client = new ModbusRTU();

// open connection to a serial port
client.connectRTU("/dev/ttyUSB0", {baudrate: 9600}, write);

function write() {
    client.setID(1);

    // write the values 0, 0xffff to registers starting at address 5
    // on device number 1.
    client.writeRegisters(5, [0 , 0xffff])
        .then(read);
}

function read() {
    // read the 2 registers starting at address 5
    // on device number 1.
    client.readHoldingRegisters(5, 2)
        .then(console.log);
}
```
----
###### Logger
``` javascript
// create an empty modbus client
var ModbusRTU = require("modbus-serial");
var client = new ModbusRTU();

// open connection to a serial port
client.connectRTU("/dev/ttyUSB0", {baudrate: 9600});
client.setID(1);

// read the values of 10 registers starting at address 0
// on device number 1. and log the values to the console.
setInterval(function() {
    client.readHoldingRegisters(0, 10, function(err, data) {
        console.log(data.data);
    });
}, 1000);
```
----
###### Logger-TCP
``` javascript
// create an empty modbus client
var ModbusRTU = require("modbus-serial");
var client = new ModbusRTU();

// open connection to a tcp line
client.connectTCP("192.168.1.42");
client.setID(1);

// read the values of 10 registers starting at address 0
// on device number 1. and log the values to the console.
setInterval(function() {
    client.readHoldingRegisters(0, 10, function(err, data) {
        console.log(data.data);
    });
}, 1000);
```
----
###### Read raw buffer
``` javascript
// create an empty modbus client
var ModbusRTU = require("modbus-serial");
var client = new ModbusRTU();

// open connection to a serial port
client.connectRTU("/dev/ttyUSB0", {baudrate: 9600}, run);

function run() {
    client.setID(1);

    // read 2 16bit-registers to get one 32bit number
    client.readInputRegisters(5, 2, function(err, data) {
        var int32 = data.buffer.readUInt32BE();
        console.log(int32);
    });
}
```

#### Methods

----
###### API promises
----

The communication functions have a wrapper function that use
a pre-set unit-id and return a promise.

```javascript
// set the client's unit id
client.setID(1);

// read 8 discrete inputs starting at input 10
// (function use the unit id 1, we set earlier)
client.readDiscreteInputs(10, 8)
    .then(function(data) {
        console.log(data);
    });
```

----
##### .setID(id)
Sets the unit id

###### id
The new client id

----
##### .readCoils (address, length)
Writes "Read Coils" (FC=1) request to serial port.

###### address
The Data Address of the first register.

###### length
The total number of registers requested.

----
##### .readDiscreteInputs (address, length)
Writes "Read Discrete Inputs" (FC=2) request to serial port.

###### address
The Data Address of the first register.

###### length
The total number of registers requested.

----
##### .readHoldingRegisters (address, length)
Writes "Read Holding Registers" (FC=3) request to serial port.

###### address
The Data Address of the first register.

###### length
The total number of registers requested.

----
##### .readInputRegisters (address, length)
Writes "Read Input Registers" (FC=4) request to serial port.

###### address
The Data Address of the first register.

###### length
The total number of registers requested.

----
##### .writeCoil(address, state)
Writes "Force Coil Status" (FC=5) request to serial port.

###### address
The Data Address of the coil.

###### state
The state to force into coil.

----
##### .writeRegisters (address, array)
Writes "Preset Multiple Registers" (FC=16) request to serial port.

###### address
The Data Address of the first register.

###### array
The array of values to set into the registers.

----
###### API
----
##### .open(callback)
Opens a modbus connection using the given serial port.

###### callback (optional)
Called when a connection has been opened.

----
##### .writeFC1 (unit, address, length, callback)
Writes "Read coil status" (FC=01) request to serial port.

###### unit
The slave unit address.

###### address
The Data Address of the first coil.

###### length
The total number of coils requested.

###### callback (optional)
Called once the unit returns an answer. The callback should be a function 
that looks like: function (error, data) { ... }
```
error - null on success, error string o/w
data - an object with two fildes:
    data.data: array of boolean coils (in multiples of 8 = one byte).
    data.buffer: raw baffer of bytes returned by slave.
```

----
##### .writeFC2 (unit, address, length, callback)
Writes "Read input status" (FC=02) request to serial port.

###### unit
The slave unit address.

###### address
The Data Address of the first digital input.

###### length
The total number of digital inputs requested.

###### callback (optional)
Called once the unit returns an answer. The callback should be a function 
that looks like: function (error, data) { ... }
```
error - null on success, error string o/w
data - an object with two fildes:
    data.data: array of boolean digital inputs (in multiples of 8 = one byte).
    data.buffer: raw baffer of bytes returned by slave.
```

----
##### .writeFC3 (unit, address, length, callback)
Writes "Read Holding Registers" (FC=03) request to serial port.

###### unit
The slave unit address.

###### address
The Data Address of the first register.

###### length
The total number of registers requested.

###### callback (optional)
Called once the unit returns an answer. The callback should be a function 
that looks like: function (error, data) { ... }
```
error - null on success, error string o/w
data - an object with two fildes:
    data.data: array of unsinged 16 bit registers.
    data.buffer: raw baffer of bytes returned by slave.
```

----
##### .writeFC4 (unit, address, length, callback)
Writes "Read Input Registers" (FC=04) request to serial port.

###### unit
The slave unit address.

###### address
The Data Address of the first register.

###### length
The total number of registers requested.

###### callback (optional)
Called once the unit returns an answer. The callback should be a function 
that looks like: function (error, data) { ... }
```
error - null on success, error string o/w
data - an object with two fildes:
    data.data: array of unsinged 16 bit registers.
    data.buffer: raw baffer of bytes returned by slave.
```

----
##### .writeFC5 (unit, address, state, callback)
Writes "Force Single Coil" (FC=05) request to serial port.

###### unit
The slave unit address.

###### address
The Data Address of the coil.

###### state
The state to set into the coil (true / false).

###### callback (optional)
Called once the unit returns an answer. The callback should be a function 
that looks like: function (error, data) { ... }

----
##### .writeFC16 (unit, address, array, callback)
Writes "Preset Multiple Registers" (FC=16) request to serial port.

###### unit
The slave unit address.

###### address
The Data Address of the first register.

###### array
The array of values to set into the registers.

###### callback (optional)
Called once the unit returns an answer. The callback should be a function 
that looks like: function (error, data) { ... }

----
###### API connection shorthand
----

The shorthand connection functions creates a port and open it.

Long way, without shorthand:
``` javascript
// open a serial port
var SerialPort = require("serialport").SerialPort;
var serialPort = new SerialPort("/dev/ttyUSB0", {baudrate: 9600});

// create a modbus client using the serial port
var ModbusRTU = require("modbus-serial");
var client = new ModbusRTU(serialPort);

// open connection to a serial port
client.open();

// tell your coffee machine to do something ...
```

Using shorthand:
``` javascript
// create an empty modbus client
var ModbusRTU = require("modbus-serial");
var client = new ModbusRTU();

// open connection to a serial port
client.connectRTU("/dev/ttyUSB0", {baudrate: 9600});

// tell your robot to do something ...
```

Using shorthand (TCP):
``` javascript
// create an empty modbus client
var ModbusRTU = require("modbus-serial");
var client = new ModbusRTU();

// open connection to a tcp line
client.connectTCP("192.168.1.42");

// tell your robot to do something ...
```
----
##### .connectRTU (path, options, callback)
Connect using serial port.

###### path
The port path (e.g. "/dev/ttyS0")

###### options (optional)
The options for this connection.

###### callback (optional)
Called once the client is connected.

----
##### .connectTCP (ip, options, callback)
Connect using tcp/ip.

###### ip
The port ip (e.g. "24.230.1.42")

###### options (optional)
The options for this connection.

###### callback (optional)
Called once the client is connected.

