'use strict';
var util = require('util');
var events = require('events');

/**
 * Simulate a serial port with 4 modbus-rtu slaves connected
 * 1 - a modbus slave working correctly
 * 2 - a modbus slave that answer short replays
 * 3 - a modbus slave that answer with bad crc
 * 4 - a modbus slave that answer with bad unit number
 */
var TestPort = function() {
    // simulate 14 registers
    this._registers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    this._holding_registers = [0,0,0,0,0,0,0,0, 0xa12b, 0xffff, 0xb21a ];
    events.call(this);
}
util.inherits(TestPort, events);

/**
 * calculate crc16
 *
 * @param {buffer} buf the buffer to to crc on.
 *
 * @return {number} the calculated crc16
 */
function crc16(buf) {
    var length = buf.length - 2;
    var crc = 0xFFFF;
    var tmp;
    
    // calculate crc16
    for (var i = 0; i < length; i++) {
        crc = crc ^ buf[i];
        
        for (var j = 0; j < 8; j++) {
            tmp = crc & 0x0001;
            crc = crc >> 1;
            if (tmp) {
              crc = crc ^ 0xA001;
            }
        }
    }
    
    return crc;
}

/**
 * Simulate successful port open
 */
TestPort.prototype.open = function (callback) {
    if (callback)
        callback(null);
}

/**
 * Simulate successful close port
 */
TestPort.prototype.close = function (callback) {
    if (callback)
        callback(null);
}

/**
 * Simulate successful/failure port requests and replays
 */
TestPort.prototype.write = function (buf) {
    var buffer = null;
    
    // if length is too short, ignore message
    if (buf.length < 8) {
        return;
    }
    
    var unitNumber = buf[0];
    var functionCode = buf[1];
    var crc = buf[buf.length - 2] + buf[buf.length - 1] * 0x100;
    
    // if crc is bad, ignore message
    if (crc != crc16(buf)) {
        return;
    }
    
    // function code 3
    if (functionCode == 3) {
        var address = buf.readUInt16BE(2);
        var length = buf.readUInt16BE(4);
        
        // if length is bad, ignore message
        if (buf.length != 8) {
            return;
        }
        
        // build answer
        buffer = new Buffer(3 + length * 2 + 2);
        buffer.writeUInt8(length * 2, 2);
        
        // read registers
        for (var i = 0; i < length; i++) {
            buffer.writeUInt16BE(this._holding_registers[address + i], 3 + i * 2);
        }
    }
    
    // function code 4
    if (functionCode == 4) {
        var address = buf.readUInt16BE(2);
        var length = buf.readUInt16BE(4);
        
        // if length is bad, ignore message
        if (buf.length != 8) {
            return;
        }
        
        // build answer
        buffer = new Buffer(3 + length * 2 + 2);
        buffer.writeUInt8(length * 2, 2);
        
        // read registers
        for (var i = 0; i < length; i++) {
            buffer.writeUInt16BE(this._registers[address + i], 3 + i * 2);
        }
    }
    
    // function code 16
    if (functionCode == 16) {
        var address = buf.readUInt16BE(2);
        var length = buf.readUInt16BE(4);
        
        // if length is bad, ignore message
        if (buf.length != (7 + length * 2 + 2)) {
            return;
        }
        
        // build answer
        buffer = new Buffer(8);
        buffer.writeUInt16BE(address, 2);
        buffer.writeUInt16BE(length, 4);
        
        // write registers
        for (var i = 0; i < length; i++) {
            this._registers[address + i] = buf.readUInt16BE(7 + i * 2);
        }
    }
    
    // send data back
    if (buffer) {
        // add unit number and function code
        buffer.writeUInt8(unitNumber, 0);
        buffer.writeUInt8(functionCode, 1);
        
        // add crc
        crc = crc16(buffer);
        buffer.writeUInt16LE(crc, buffer.length - 2);
        
        // corrupt the answer
        switch (unitNumber) {
            case 1:
                // unit 1: answers correctly
                break;
            case 2:
                // unit 2: answers short data
                buffer = buffer.slice(0, buffer.length - 5);
                break;
            case 3:
                // unit 3: answers with bad crc
                buffer.writeUInt16LE(crc + 1, buffer.length - 2);
                break;
            case 4:
                // unit 4: answers with bad unit number
                buffer[0] = unitNumber + 2;
                break;
        }
        
        this.emit('data', buffer);
    }
}

module.exports = TestPort;
