'use strict';
var util = require('util');
var events = require('events');

/**
 * Simulate a serial port with modbus-rtu slave replay
 */
var TestPort = function() {
    this._buffer = new Buffer('', 'hex');
    events.call(this);
}
util.inherits(TestPort, events);

/**
 * calculate crc16
 *
 * @param {buffer} buf the buffer to to crc on.
 *
 * @return {number} the calculated CRC16
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
    callback(null);
}

/**
 * Simulate successful/failure port requests and replays
 */
TestPort.prototype.write = function (buf) {
    var buffer = null;
    var unitNumber = buf[0];
    var functionCode = buf[1];
    var crc = buf[buf.length - 2] + buf[buf.length - 1] * 0x100;
    
    // if crc is bad, ignore message
    if (crc != crc16(buf)) {
        return;
    }
    
    // function code 4
    if (functionCode == 4) {
        switch (unitNumber) {
            case 1:
                // unit 1: answers correctly
                buffer = new Buffer('010402000A3937', 'hex');
                break;
            case 2:
                // unit 2: answers short data
                buffer = new Buffer('020402000A', 'hex');
                break;
            case 3:
                // unit 3: answers with bad crc
                buffer = new Buffer('030402000A3937', 'hex');
                break;
            case 4:
                // unit 4: answers with bad unit number
                buffer = new Buffer('010402000A3937', 'hex');
                break;
        }
    }
    
    // function code 16
    if (functionCode == 16) {
        switch (unitNumber) {
            case 1:
                // unit 1: answers correctly
                buffer = new Buffer('0110000100021008', 'hex');
                break;
            case 2:
                // unit 2: answers short data
                buffer = new Buffer('0210000100', 'hex');
                break;
            case 3:
                // unit 3: answers with bad crc
                buffer = new Buffer('0310000100021008', 'hex');
                break;
            case 4:
                // unit 4: answers with bad unit number
                buffer = new Buffer('0110000100021010', 'hex');
                break;
        }
    }
    
    if (buffer) {
        this.emit('data', buffer);
    }
}

module.exports = TestPort;
