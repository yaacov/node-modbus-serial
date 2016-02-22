'use strict';
var util = require('util');
var events = require('events');
var net = require('net');

var EXCEPTION_LENGTH = 5;
var TELNET_PORT = 2217;

/**
 * Simulate a modbus-RTU port using Telent connection
 */
var TelnetPort = function(ip, options) {
    var self = this;
    this.ip = ip;
    this.openFlag = false;

    // options
    if (typeof(options) == 'undefined') options = {};
    this.port = options.port || TELNET_PORT; // telnet server port

    // internal buffer
    this._buffer = new Buffer(0);
    this._id = 0;
    this._cmd = 0;
    this._length = 0;

    // create a socket
    this._client = new net.Socket();

    // register the port data event
    this._client.on('data', function onData(data) {
        // add data to buffer
        self._buffer = Buffer.concat([self._buffer, data]);

        // check if buffer include a complete modbus answer
        var expectedLength = self._length;
        var bufferLength = self._buffer.length ;

        // check data length
        if (expectedLength < 6 || bufferLength < EXCEPTION_LENGTH) return;

        // loop and check length-sized buffer chunks
        var maxOffset = bufferLength - EXCEPTION_LENGTH;
        for (var i = 0; i <= maxOffset; i++) {
            var unitId = self._buffer[i];
            var functionCode = self._buffer[i+1];

            if (unitId !== self._id) continue;

            if (functionCode === self._cmd && i + expectedLength <= bufferLength) {
                self._emitData(i, expectedLength);
                return;
            }
            if (functionCode === (0x80 | self._cmd) && i + EXCEPTION_LENGTH <= bufferLength) {
                self._emitData(i, EXCEPTION_LENGTH);
                return;
            }
        }
    });

    this._client.on('connect', function() {
        self.openFlag = true;
    });

    this._client.on('close', function(had_error) {
        self.openFlag = false;
    });

    events.call(this);
};
util.inherits(TelnetPort, events);

/**
 * Emit the received response, cut the buffer and reset the internal vars.
 * @param {number} start the start index of the response within the buffer
 * @param {number} length the length of the response
 * @private
 */
TelnetPort.prototype._emitData = function(start, length) {
    this.emit('data', this._buffer.slice(start, start + length));
    this._buffer = this._buffer.slice(start + length);

    // reset internal vars
    this._id = 0;
    this._cmd = 0;
    this._length = 0;
};

/**
 * Simulate successful port open
 */
TelnetPort.prototype.open = function (callback) {
    this._client.connect(this.port, this.ip, callback);
};

/**
 * Simulate successful close port
 */
TelnetPort.prototype.close = function (callback) {
    this._client.end();
    if (callback)
        callback(null);
};

/**
 * Check if port is open
 */
TelnetPort.prototype.isOpen = function() {
    return this.openFlag;
};

/**
 * Send data to a modbus slave via telnet server
 */
TelnetPort.prototype.write = function (data) {
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
        case 15:
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
};

module.exports = TelnetPort;
