# modbus-serial

A pure JavaScript implemetation of MODBUS-RTU (Serial and TCP) for NodeJS.

[![NPM download](https://img.shields.io/npm/dm/modbus-serial.svg)](http://www.npm-stats.com/~packages/modbus-serial)
[![NPM version](https://badge.fury.io/js/modbus-serial.png)](http://badge.fury.io/js/modbus-serial)
![Build Status](https://github.com/yaacov/node-modbus-serial/workflows/ci/badge.svg)


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

###### Version of NodeJS:
This module has not been tested on every single version of NodeJS. For best results you should stick to LTS versions, which are denoted by even major version numbers e.g. 4.x, 6.x, 8.x.

###### These classes are implemented:

| Class | Function |
|-------|----------|
| FC1 "Read Coil Status" | `readCoils(coil, len)` |
| FC2 "Read Input Status" | `readDiscreteInputs(addr, arg)` |
| FC3 "Read Holding Registers" | `readHoldingRegisters(addr, len) ` |
| FC4 "Read Input Registers" | `readInputRegisters(addr, len) ` |
| FC5 "Force Single Coil" | `writeCoil(coil, binary) //NOT setCoil` |
| FC6 "Preset Single Register" | `writeRegister(addr, value)` |
 | FC15 "Force Multiple Coil" | `writeCoils(addr, valueAry)` |
| FC16 "Preset Multiple Registers" | `writeRegisters(addr, valueAry)` |
| FC43/14 "Read Device Identification" (supported ports: TCP, RTU) | `readDeviceIdentification(id, obj)` |

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
client.connectRTUBuffered("/dev/ttyUSB0", { baudRate: 9600 }, write);

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
###### Read on multiple slaves
``` javascript
const ModbusRTU = require("modbus-serial");
// create an empty modbus client
const client = new ModbusRTU();
// open connection to a serial port
client.connectRTUBuffered("/dev/ttyS0", { baudRate: 9600 });
// set timeout, if slave did not reply back
client.setTimeout(500);

// list of meter's id
const metersIdList = [10, 11, 12, 13, 14];

const getMetersValue = async (meters) => {
    try{
        // get value of all meters
        for(let meter of meters) {
            // output value to console
            console.log(await getMeterValue(meter));
            // wait 100ms before get another device
            await sleep(100);
	}
    } catch(e){
        // if error, handle them here (it should not)
        console.log(e)
    } finally {
        // after get all data from salve repeate it again
        setImmediate(() => {
            getMetersValue(metersIdList);
        })
    }
}

const getMeterValue = async (id) => {
    try {
        // set ID of slave
        await client.setID(id);
        // read the 1 registers starting at address 0 (first register)
        let val =  await client.readInputRegisters(0, 1);
        // return the value
        return val.data[0];
    } catch(e){
        // if error return -1
        return -1
    }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));


// start get value
getMetersValue(metersIdList);

```
----
###### Logger Serial
``` javascript
// create an empty modbus client
var ModbusRTU = require("modbus-serial");
var client = new ModbusRTU();

// open connection to a serial port
client.connectRTUBuffered("/dev/ttyUSB0", { baudRate: 9600 });
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
client.connectTCP("127.0.0.1", { port: 8502 });
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
###### Logger UDP
``` javascript
// create an empty modbus client
var ModbusRTU = require("modbus-serial");
var client = new ModbusRTU();

// open connection to a udp line
client.connectUDP("127.0.0.1", { port: 8502 });
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
    getInputRegister: function(addr, unitID) {
        // Synchronous handling
        return addr;
    },
    getHoldingRegister: function(addr, unitID, callback) {
        // Asynchronous handling (with callback)
        setTimeout(function() {
            // callback = function(err, value)
            callback(null, addr + 8000);
        }, 10);
    },
    getCoil: function(addr, unitID) {
        // Asynchronous handling (with Promises, async/await supported)
        return new Promise(function(resolve) {
            setTimeout(function() {
                resolve((addr % 2) === 0);
            }, 10);
        });
    },
    setRegister: function(addr, value, unitID) {
        // Asynchronous handling supported also here
        console.log("set register", addr, value, unitID);
        return;
    },
    setCoil: function(addr, value, unitID) {
        // Asynchronous handling supported also here
        console.log("set coil", addr, value, unitID);
        return;
    },
    readDeviceIdentification: function(addr) {
        return {
            0x00: "MyVendorName",
            0x01: "MyProductCode",
            0x02: "MyMajorMinorRevision",
            0x05: "MyModelName",
            0x97: "MyExtendedObject1",
            0xAB: "MyExtendedObject2"
        };
    }
};

// set the server to answer for modbus requests
console.log("ModbusTCP listening on modbus://0.0.0.0:8502");
var serverTCP = new ModbusRTU.ServerTCP(vector, { host: "0.0.0.0", port: 8502, debug: true, unitID: 1 });

serverTCP.on("socketError", function(err){
    // Handle socket error if needed, can be ignored
    console.error(err);
});
```
----
###### Read and Write Modbus ASCII
``` javascript
// create an empty modbus client
var Modbus = require("modbus-serial");
var client = new Modbus();

// open connection to a serial port
client.connectAsciiSerial(
    "/dev/ttyUSB0", 
    {
        baudRate: 9600,
        startOfSlaveFrameChar: 0x3A  // optional: slave frame delimiter
    }, 
    write);

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


to get more see [Examples](https://github.com/yaacov/node-modbus-serial/wiki)

###### Serial connection

node-modbus-serial use node-serialport for serial communication, for serial port options settings
it passes to serial port the [openOptions](https://node-serialport.github.io/node-serialport/global.html#openOptions) object,
default serial port settings are 9600,8,n,1.

``` javascript
client.connectRTUBuffered("/dev/ttyUSB0", { baudRate: 9600, parity: 'even' });
```
