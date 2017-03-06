# modbus-serial

A pure JavaScript implemetation of MODBUS-RTU (Serial and TCP) for NodeJS.

[![NPM download](https://img.shields.io/npm/dm/modbus-serial.svg)](http://www.npm-stats.com/~packages/modbus-serial)
[![NPM version](https://badge.fury.io/js/modbus-serial.png)](http://badge.fury.io/js/modbus-serial)
[![Build Status](https://travis-ci.org/yaacov/node-modbus-serial.svg?branch=master)](https://travis-ci.org/yaacov/node-modbus-serial)


Modbus is a serial communications protocol, first used in 1979.
Modbus is simple and robust, openly published, royalty-free and
easy to deploy and maintain.

**This package makes Modbus calls and serve fun and easy.**

----

- [What can I do with this module ?](#what-can-i-do-with-this-module-)
- [Compatibility](#compatibility)
- [Examples](#examples)
- [Methods](https://github.com/yaacov/node-modbus-serial/wiki/Methods)

----

#### Install

    npm install modbus-serial

try these options on npm install to build, if you have problems to install

    --unsafe-perm --build-from-source

For use over serial port (ModbusRTU), also install node-serialport:

    npm install serialport@4.0.7


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

###### This classes are implemented:

* FC1 "Read Coil Status"
* FC2 "Read Input Status"
* FC3 "Read Holding Registers"
* FC4 "Read Input Registers"
* FC5 "Force Single Coil"
* FC6 "Preset Single Register"
* FC15 "Force Multiple Coil"
* FC16 "Preset Multiple Registers"

###### Client Serial:

* modbus-RTU (SerialPort): Over serial line [require node serialport].
* modbus-RTU (RTUBufferedPort): Over buffered serial line [require node serialport].
* modbus-ASCII (AsciiPort): Over serial line [require node serialport].

###### Client TCP:

* modbus-TCP (TcpPort): Over TCP/IP line.
* modbus-RTU (UdpPort): Over C701 server, commercial UDP to serial bridge.
* modbus-RTU (TcpRTUBufferedPort): Over TCP/IP line, TCP/IP serial RTU buffered device.
* modbus-RTU (TelnetPort): Over Telnet server, TCP/IP serial bridge.

###### Server

* modbus-TCP (ServerTCP): Over TCP/IP line.


#### Examples

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
###### Logger Serial
``` javascript
// create an empty modbus client
var ModbusRTU = require("modbus-serial");
var client = new ModbusRTU();

// open connection to a serial port
client.connectRTUBuffered("/dev/ttyUSB0", {baudrate: 9600});
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
###### Logger TCP
``` javascript
// create an empty modbus client
var ModbusRTU = require("modbus-serial");
var client = new ModbusRTU();

// open connection to a tcp line
client.connectTCP("127.0.0.1", {port: 8502});
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
###### ModbusTCP Server
``` javascript
// create an empty modbus client
var ModbusRTU = require("modbus-serial");
var vector = {
      getInputRegister: function(addr, unitID) { return addr; },
      getHoldingRegister: function(addr, unitID) { return addr + 8000; },
      getCoil: function(addr, unitID) { return (addr % 2) === 0; },
      setRegister: function(addr, value, unitID) { console.log('set register', addr, value, unitID); return; },
      setCoil: function(addr, value, unitID) { console.log('set coil', addr, value, unitID); return; }
};

// set the server to answer for modbus requests
console.log('ModbusTCP listening on modbus://0.0.0.0:8502');
var serverTCP = new ModbusRTU.ServerTCP(vector, {host: '0.0.0.0', port: 8502, debug: true, unitID: 1});
```

to get more see [Examples](https://github.com/yaacov/node-modbus-serial/wiki)
