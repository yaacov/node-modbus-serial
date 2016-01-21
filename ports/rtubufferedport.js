'use strict';
var util = require('util');
var events = require('events');
var SerialPort = require("serialport").SerialPort;

/**
 * calculate crc16
 *
 * @param {buffer} buf the buffer to to crc on.
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
 * check if a buffer chunk can be a modbus answer
 *
 * @param {buffer} buf the buffer to check.
 * @return {boolean} if the buffer can be an answer
 */
function checkData(modbus, buf) {
    // check buffer size
    if (buf.length != modbus._length) return false;

    // calculate crc16
    var crcIn = buf.readUInt16LE(buf.length - 2);

    // check buffer unit-id, command and crc
    return (buf[0] == modbus._id &&
        buf[1] == modbus._cmd &&
        crcIn == crc16(buf));
}

/**
 * Simulate a modbus-RTU port using buffered serial connection
 */
var RTUBufferedPort = function(path, options) {
    var modbus = this;

    // options
    if (typeof(options) == 'undefined') options = {};

    // internal buffer
    this._buffer = new Buffer(0);
    this._id = 0;
    this._cmd = 0;
    this._length = 0;

    // create the SerialPort
    this._client= new SerialPort(path, options);

    // register the port data event
    this._client.on('data', function(data) {
        /* add data to buffer
         */
        modbus._buffer = Buffer.concat([modbus._buffer, data]);

        /* check if buffer include a complete modbus answer
         */
        var length = modbus._length;
        var bufferLength = modbus._buffer.length ;

        // check data length
        if (bufferLength < 6 || length < 6) return;

        // loop and check length-sized buffer chunks
        for (var i = 0; i < (bufferLength - length + 1); i++) {
            // cut a length of bytes from buffer
            var _data = modbus._buffer.slice(i, i + length);

            // check if this is the data we are waiting for
            if (checkData(modbus, _data)) {
                // adjust i to end of data chunk
                i = i + length;

                // emit a data signal
                modbus.emit('data', _data);
            }
        }

        /* cut checked data from buffer
         */
        if (i) {
            modbus._buffer = modbus._buffer.slice(i);
        }
    });

    events.call(this);
}
util.inherits(RTUBufferedPort, events);

/**
 * Simulate successful port open
 */
RTUBufferedPort.prototype.open = function (callback) {
    this._client.open(callback);
}

/**
 * Simulate successful close port
 */
RTUBufferedPort.prototype.close = function (callback) {
    this._client.close(callback);
}
/**
 * Send data to a modbus slave via telnet server
 */
RTUBufferedPort.prototype.write = function (data) {
    // check data length
    if (data.length < 6) {
        // raise an error ?
        return;
    }

    // remember current unit and command
    this._id = data[0];
    this._cmd = data[1];

    // calculate expected answer length
    switch (this._cmd) {
        case 1:
        case 2:
            var length = data.readUInt16BE(4);
            this._length = 3 + parseInt((length - 1) / 8 + 1) + 2;
            break;
        case 3:
        case 4:
            var length = data.readUInt16BE(4);
            this._length = 3 + 2 * length + 2;
            break;
        case 5:
        case 6:
        case 16:
            this._length = 6 + 2;
            break;
        default:
            // raise and error ?
            this._length = 0;
            break;
    }

    // send buffer to slave
    this._client.write(data);
}

module.exports = RTUBufferedPort;
