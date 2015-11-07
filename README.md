# modbus-serial
A pure JavaScript implemetation of MODBUS-RTU for NodeJS

[![NPM Version](https://img.shields.io/npm/v/gm.svg?style=flat)](https://www.npmjs.com/package/modbus-serial)

This class makes ModbusRTU calls fun and easy.

Modbus is a serial communications protocol, first used in 1979.
Modbus is simple and robust, openly published, royalty-free and 
easy to deploy and maintain.

## Install

```
npm install modbus-serial
```

## What can I do with this module ?

This class makes it fun and easy to communicate with electronic
devices such as irrigation controllers, protocol droids and robots.
It talks with devices that use a serial line (e.g. RS485, RS232).
Many industrial electronic devices implement modbus.
Arduino can also talk modbus and you can control your projects and robots
using modbus. Arduino library for modbus slave:
     https://github.com/smarmengol/Modbus-Master-Slave-for-Arduino
     
## Compatibility

This class implements FC4 (Read Input Registers) and 
FC16 (Preset Multiple Registers) of modbus-RTU.

## Requires

node-serialport - for using the serial port.
     https://github.com/voodootikigod/node-serialport
     
## Example
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

## Methods

### .open(callback)
Opens a modbus connection using the given serial port.

#### callback (optional)
Called when a connection has been opened.

### .writeFC4 (unit, address, length, callback)
Writes Read Input Registers (FC=04) request to serial port.

#### unit
The slave unit address.

#### address
The Data Address of the first register.

#### length
The total number of registers requested.

#### callback (optional)
Called once the unit returns an answer. The callback should be a function 
that looks like: function (error, data) { ... }

### .writeFC16 (unit, address, array, callback)
Writes Preset Multiple Registers (FC=16) request to serial port.

#### unit
The slave unit address.

#### address
The Data Address of the first register.

#### array
The array of values to set into the registers.

#### callback (optional)
Called once the unit returns an answer. The callback should be a function 
that looks like: function (error, data) { ... }

