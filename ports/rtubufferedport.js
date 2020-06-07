"use strict";
var util = require("util");
var events = require("events");
var EventEmitter = events.EventEmitter || events;
var SerialPort = require("serialport");
var modbusSerialDebug = require("debug")("modbus-serial");

/* TODO: const should be set once, maybe */
var EXCEPTION_LENGTH = 5;
var MIN_DATA_LENGTH = 6;
var MAX_BUFFER_LENGTH = 256;

/**
 * Simulate a modbus-RTU port using buffered serial connection.
 *
 * @param path
 * @param options
 * @constructor
 */
var RTUBufferedPort = function(path, options) {
    var self = this;

    // options
    if (typeof(options) === "undefined") options = {};

    // disable auto open, as we handle the open
    options.autoOpen = false;

    // internal buffer
    this._buffer = Buffer.alloc(0);
    this._id = 0;
    this._cmd = 0;
    this._length = 0;

    // create the SerialPort
    this._client = new SerialPort(path, options);

    // register the port data event
    this._client.on("data", function onData(data) {
        // add data to buffer
        self._buffer = Buffer.concat([self._buffer, data]);

        // check if buffer include a complete modbus answer
        var expectedLength = self._length;
        var bufferLength = self._buffer.length;

        modbusSerialDebug({ action: "receive serial rtu buffered port", data: data, buffer: self._buffer });

        // check data length
        if (expectedLength < MIN_DATA_LENGTH || bufferLength < EXCEPTION_LENGTH) return;

        // check buffer size for MAX_BUFFER_SIZE
        if (bufferLength > MAX_BUFFER_LENGTH) {
            self._buffer = self._buffer.slice(-MAX_BUFFER_LENGTH);
            bufferLength = MAX_BUFFER_LENGTH;
        }

        // loop and check length-sized buffer chunks
        var maxOffset = bufferLength - EXCEPTION_LENGTH;
        for (var i = 0; i <= maxOffset; i++) {
            var unitId = self._buffer[i];
            var functionCode = self._buffer[i + 1];

            if (unitId !== self._id) continue;

            if (functionCode === self._cmd && i + expectedLength <= bufferLength) {
                self._emitData(i, expectedLength);
                return;
            }
            if (functionCode === (0x80 | self._cmd) && i + EXCEPTION_LENGTH <= bufferLength) {
                self._emitData(i, EXCEPTION_LENGTH);
                return;
            }

            // frame header matches, but still missing bytes pending
            if (functionCode === (0x7f & self._cmd)) break;
        }
    });

    /**
     * Check if port is open.
     *
     * @returns {boolean}
     */
    Object.defineProperty(this, "isOpen", {
        enumerable: true,
        get: function() {
            return this._client.isOpen;
        }
    });

    EventEmitter.call(this);
};
util.inherits(RTUBufferedPort, EventEmitter);

/**
 * Emit the received response, cut the buffer and reset the internal vars.
 *
 * @param {number} start The start index of the response within the buffer.
 * @param {number} length The length of the response.
 * @private
 */
RTUBufferedPort.prototype._emitData = function(start, length) {
    var buffer = this._buffer.slice(start, start + length);

    modbusSerialDebug({ action: "emit data serial rtu buffered port", buffer: buffer });

    this.emit("data", buffer);
    this._buffer = this._buffer.slice(start + length);
};

/**
 * Simulate successful port open.
 *
 * @param callback
 */
RTUBufferedPort.prototype.open = function(callback) {
    this._client.open(callback);
};

/**
 * Simulate successful close port.
 *
 * @param callback
 */
RTUBufferedPort.prototype.close = function(callback) {
    this._client.close(callback);
};

/**
 * Send data to a modbus slave.
 *
 * @param {Buffer} data
 */
RTUBufferedPort.prototype.write = function(data) {
    if(data.length < MIN_DATA_LENGTH) {
        modbusSerialDebug("expected length of data is to small - minimum is " + MIN_DATA_LENGTH);
        return;
    }

    var length = null;

    // remember current unit and command
    this._id = data[0];
    this._cmd = data[1];

    // calculate expected answer length
    switch (this._cmd) {
        case 1:
        case 2:
            length = data.readUInt16BE(4);
            this._length = 3 + parseInt((length - 1) / 8 + 1) + 2;
            break;
        case 3:
        case 4:
            length = data.readUInt16BE(4);
            this._length = 3 + 2 * length + 2;
            break;
        case 5:
        case 6:
        case 15:
        case 16:
            this._length = 6 + 2;
            break;
        case 43:
            modbusSerialDebug("RTUBuffered F43 not supported");
            this._length = 0;
            break;
        default:
            // raise and error ?
            this._length = 0;
            break;
    }

    // send buffer to slave
    this._client.write(data);

    modbusSerialDebug({
        action: "send serial rtu buffered",
        data: data,
        unitid: this._id,
        functionCode: this._cmd
    });
};

/**
 * RTU buffered port for Modbus.
 *
 * @type {RTUBufferedPort}
 */
module.exports = RTUBufferedPort;
