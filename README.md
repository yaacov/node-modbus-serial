# modbus-serial
A pure JavaScript implemetation of MODBUS-RTU (and TCP) for NodeJS

[![NPM Version](https://img.shields.io/npm/v/gm.svg?style=flat)](https://www.npmjs.com/package/modbus-serial)

This class makes ModbusRTU (and TCP) calls fun and easy.

Modbus is a serial communications protocol, first used in 1979.
Modbus is simple and robust, openly published, royalty-free and 
easy to deploy and maintain.

- [modbus-serial](#modbus-serial)
      - [Install](#install)
      - [Requires](#requires)
      - [What can I do with this module ?](#what-can-i-do-with-this-module-)
      - [Compatibility](#compatibility)
      - [Examples](#examples)
      - [Methods](#methods)
            - [API](#api)
      - [Methods That return a promise](#methods-that-return-a-promise)
            - [API Promises](#api-promises)

#### Install

```
npm install modbus-serial
```

#### Requires

###### node-serialport - for using the serial port.

For use over serial port (ModbusRTU), also install node-serialport:
```
npm install serialport
```

https://github.com/voodootikigod/node-serialport

[ TCP/IP connection does not require the node-serialport package. ]

#### What can I do with this module ?

This class makes it fun and easy to communicate with electronic
devices such as irrigation controllers, protocol droids and robots.
It talks with devices that use a serial line (e.g. RS485, RS232).
Many industrial electronic devices implement modbus.
Arduino can also talk modbus and you can control your projects and robots
using modbus. 

Arduino library for modbus slave:
     https://github.com/smarmengol/Modbus-Master-Slave-for-Arduino
     
Arduino sketch for irrigation timer with modbus support:
     https://github.com/yaacov/arduino-irrigation-timer
     
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
###### Read and Write
``` javascript
var SerialPort = require("serialport").SerialPort;
var serialPort = new SerialPort("/dev/ttyUSB0", {baudrate: 9600});
var ModbusRTU = require("modbus-serial");
var modbusRTU = new ModbusRTU(serialPort);

modbusRTU.open();

// write the values 0, 0xffff to registers starting at address 5
// on device number 1.
setTimeout(function() {
     modbusRTU.writeFC16(1, 5, [0 , 0xffff]);
}, 1000);

// read the values of 2 registers starting at address 5
// on device number 1. and log the values to the console.
setTimeout(function() {
     modbusRTU.writeFC4(1, 5, 2, function(err, data) {
         console.log(data);
     });
}, 2000);

// close communication
setTimeout(function() {
   serialPort.close();
}, 3000);
```
----
###### Logger
``` javascript
var SerialPort = require("serialport").SerialPort;
var serialPort = new SerialPort("/dev/ttyUSB0", {baudrate: 9600});
var ModbusRTU = require("modbus-serial");
var modbusRTU = new ModbusRTU(serialPort);

modbusRTU.open();

// read the values of 10 registers starting at address 0
// on device number 1. and log the values to the console.
setInterval(function() {
    modbusRTU.writeFC4(1, 0, 10, function(err, data) {
        console.log(data.data);
    });
}, 1000);
```
----
###### Logger-TCP
``` javascript
var TcpPort = require("modbus-serial").TcpPort;
var tcpPort = new TcpPort("192.168.1.42");
var ModbusRTU = require("modbus-serial");
var modbusRTU = new ModbusRTU(tcpPort);

modbusRTU.open();

// read the values of 10 registers starting at address 0
// on device number 1. and log the values to the console.
setInterval(function() {
    modbusRTU.writeFC4(1, 0, 10, function(err, data) {
        console.log(data.data);
    });
}, 1000);
```
----
###### Read raw buffer
``` javascript
var SerialPort = require("serialport").SerialPort;
var serialPort = new SerialPort("/dev/ttyUSB0", {baudrate: 9600});
var ModbusRTU = require("modbus-serial");
var modbusRTU = new ModbusRTU(serialPort);

modbusRTU.open();

// read 2 16bit-registers to get one 32bit number
setTimeout(function() {
    modbusRTU.writeFC4(1, 5, 2, function(err, data) {
        console.log(data.buffer.readUInt32BE());
    });
}, 2000);

// close communication
setTimeout(function() {
   serialPort.close();
}, 3000);
```

#### Methods

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

#### Methods That return a promise

All the communication functions have an wrapper function that use
a pre-set unit-id and return a promise.

```javascript
// set the client's unit id
client.setID(1);

// read 8 discrete inputs starting at input 10
// (we use the unit id 1, we set earlier)
client.readDiscreteInputs(10, 8)
    .then(function(data) {
        console.log(data);
    });
```

###### API promises
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

