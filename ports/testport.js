'use strict';
var util = require('util');
var events = require('events');

/* Add bit operation functions to Buffer
 */
require('../apis/buffer_bit')();
var crc16 = require('./../utils/crc16');

/**
 * Simulate a serial port with 4 modbus-rtu slaves connected
 * 1 - a modbus slave working correctly
 * 2 - a modbus slave that answer short replays
 * 3 - a modbus slave that answer with bad crc
 * 4 - a modbus slave that answer with bad unit number
 */
var TestPort = function() {
    // simulate 11 input registers
    this._registers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    // simulate 11 holding registers
    this._holding_registers = [0,0,0,0,0,0,0,0, 0xa12b, 0xffff, 0xb21a ];

    // simulate 16 coils / digital inputs
    this._coils = 0x0000;

    events.call(this);
};
util.inherits(TestPort, events);

/**
 * Simulate successful port open
 */
TestPort.prototype.open = function (callback) {
    if (callback)
        callback(null);
};

/**
 * Simulate successful close port
 */
TestPort.prototype.close = function (callback) {
    if (callback)
        callback(null);
};

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
    if (crc != crc16(buf.slice(0, -2))) {
        return;
    }

    // function code 1 and 2
    if (functionCode == 1 || functionCode == 2) {
        var address = buf.readUInt16BE(2);
        var length = buf.readUInt16BE(4);

        // if length is bad, ignore message
        if (buf.length != 8) {
            return;
        }

        // build answer
        buffer = new Buffer(3 + parseInt((length - 1) / 8 + 1) + 2);
        buffer.writeUInt8(parseInt((length - 1) / 8 + 1), 2);

        // read coils
        buffer.writeUInt16LE(this._coils >> address, 3);
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

    // function code 5
    if (functionCode == 5) {
        var address = buf.readUInt16BE(2);
        var state = buf.readUInt16BE(4);

        // if length is bad, ignore message
        if (buf.length != 8) {
            return;
        }

        // build answer
        buffer = new Buffer(8);
        buffer.writeUInt16BE(address, 2);
        buffer.writeUInt16BE(state, 4);

        // write coil
        if (state == 0xff00) {
            this._coils |= (1 << address);
        } else {
            this._coils &= ~(1 << address);
        }
    }

    // function code 6
    if (functionCode == 6) {
        var address = buf.readUInt16BE(2);
        var value = buf.readUInt16BE(4);
        // if length is bad, ignore message
        if (buf.length != (6 + 2)) {
            return;
        }

        // build answer
        buffer = new Buffer(8);
        buffer.writeUInt16BE(address, 2);
        buffer.writeUInt16BE(value, 4);

        this._holding_registers[address] = value;
    }

    // function code 15
    if (functionCode == 15) {
        var address = buf.readUInt16BE(2);
        var length = buf.readUInt16BE(4);

        // if length is bad, ignore message
        if (buf.length != 7 + Math.ceil(length / 8) + 2) {
            return;
        }

        // build answer
        buffer = new Buffer(8);
        buffer.writeUInt16BE(address, 2);
        buffer.writeUInt16BE(length, 4);

        // write coils
        for (var i = 0; i < length; i++) {
            var state = buf.readBit(i, 7);
            
            if (state) {
                this._coils |= (1 << (address + i));
            } else {
                this._coils &= ~(1 << (address + i));
            }
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
            this._holding_registers[address + i] = buf.readUInt16BE(7 + i * 2);
        }
    }

    // send data back
    if (buffer) {
        // add unit number and function code
        buffer.writeUInt8(unitNumber, 0);
        buffer.writeUInt8(functionCode, 1);

        // corrupt the answer
        switch (unitNumber) {
            case 1:
                // unit 1: answers correctly
                break;
            case 2:
                // unit 2: answers short data
                buffer = buffer.slice(0, buffer.length - 5);
                break;
            case 4:
                // unit 4: answers with bad unit number
                buffer[0] = unitNumber + 2;
                break;
        }

        // add crc
        crc = crc16(buffer.slice(0, -2));
        buffer.writeUInt16LE(crc, buffer.length - 2);

        // unit 3: answers with bad crc
        if (unitNumber == 3) {
            buffer.writeUInt16LE(crc + 1, buffer.length - 2);
        }

        this.emit('data', buffer);
    }
};

module.exports = TestPort;
