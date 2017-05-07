"use strict";
var util = require("util");
var events = require("events");
var EventEmitter = events.EventEmitter || events;
var net = require("net");
var modbusSerialDebug = require("debug")("modbus-serial");

var crc16 = require("../utils/crc16");

/* TODO: const should be set once, maybe */
var EXCEPTION_LENGTH = 5;
var MIN_DATA_LENGTH = 6;
var MIN_MBAP_LENGTH = 6;
var MAX_TRANSACTIONS = 64; // maximum transaction to wait for
var CRC_LENGTH = 2;

var MODBUS_PORT = 502;

/**
 * Simulate a modbus-RTU port using TCP connection
 * @module TcpRTUBufferedPort
 *
 * @param {string} ip - ip address
 * @param {object} options - all options as JSON object
 * @constructor
 */
var TcpRTUBufferedPort = function(ip, options) {
    var self = this;
    this.ip = ip;
    this.openFlag = false;
    this.callback = null;

    // options
    if (typeof(options) === "undefined") options = {};
    this.port = options.port || MODBUS_PORT;
    this.removeCrc = options.removeCrc;

    // internal buffer
    this._buffer = new Buffer(0);
    this._id = 0;
    this._cmd = 0;
    this._length = 0;

    // handle callback - call a callback function only once, for the first event
    // it will triger
    var handleCallback = function(had_error) {
        if (self.callback) {
            self.callback(had_error);
            self.callback = null;
        }
    };

    // create a socket
    this._client = new net.Socket();

    // register the port data event
    this._client.on("data", function onData(data) {
        var buffer;

        // check data length
        if (data.length < MIN_MBAP_LENGTH) return;

        // cut 6 bytes of mbap
        buffer = new Buffer(data.length - MIN_MBAP_LENGTH);
        data.copy(buffer, 0, MIN_MBAP_LENGTH);

        // add data to buffer
        self._buffer = Buffer.concat([self._buffer, buffer]);

        modbusSerialDebug({ action: "receive tcp rtu buffered port", data: data, buffer: buffer });
        modbusSerialDebug(JSON.stringify({ action: "receive tcp rtu buffered port strings", data: data, buffer: buffer }));

        // check if buffer include a complete modbus answer
        var expectedLength = self._length;
        var bufferLength = self._buffer.length + CRC_LENGTH;

        modbusSerialDebug("on data expected length:" + expectedLength + " buffer length:" + bufferLength);

        // check data length
        if (expectedLength < MIN_MBAP_LENGTH || bufferLength < EXCEPTION_LENGTH) return;

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
        }
    });

    this._client.on("connect", function() {
        self.openFlag = true;
        handleCallback();
    });

    this._client.on("close", function(had_error) {
        self.openFlag = false;
        handleCallback(had_error);
    });

    this._client.on("error", function(had_error) {
        self.openFlag = false;
        handleCallback(had_error);
    });

    EventEmitter.call(this);
};
util.inherits(TcpRTUBufferedPort, EventEmitter);

/**
 * Emit the received response, cut the buffer and reset the internal vars.
 *
 * @param {number} start the start index of the response within the buffer
 * @param {number} length the length of the response
 * @private
 */
TcpRTUBufferedPort.prototype._emitData = function(start, length) {

    var data = this._buffer.slice(start, start + length);
    this._buffer = this._buffer.slice(start + length);

    // update transaction id
    this._transactionId = data.readUInt16BE(0);

    if (data.length > 0) {
        var buffer = Buffer.alloc(data.length + CRC_LENGTH);
        data.copy(buffer, 0);

        // add crc
        var crc = crc16(buffer.slice(0, -CRC_LENGTH));
        buffer.writeUInt16LE(crc, buffer.length - CRC_LENGTH);

        this.emit("data", buffer);
    } else {
        modbusSerialDebug({ action: "emit data to short", data: data });
    }

    // reset internal vars
    this._id = 0;
    this._cmd = 0;
    this._length = 0;
};

/**
 * Simulate successful port open.
 *
 * @param callback
 */
TcpRTUBufferedPort.prototype.open = function(callback) {
    this.callback = callback;
    this._client.connect(this.port, this.ip);
};

/**
 * Simulate successful close port.
 *
 * @param callback
 */
TcpRTUBufferedPort.prototype.close = function(callback) {
    this.callback = callback;
    this._client.end();
};

/**
 * Check if port is open.
 *
 * @returns {boolean}
 */
TcpRTUBufferedPort.prototype.isOpen = function() {
    return this.openFlag;
};

/**
 * Send data to a modbus slave via telnet server.
 *
 * @param {Buffer} data
 */
TcpRTUBufferedPort.prototype.write = function(data) {
    if (data.length < MIN_DATA_LENGTH) {
        modbusSerialDebug("expected length of data is to small - minimum is " + MIN_DATA_LENGTH);
        return;
    }

    var length = 0;

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
        default:
            // raise and error ?
            this._length = 0;
            break;
    }

    // get next transaction id
    var transactionsId = (this._transactionId + 1) % MAX_TRANSACTIONS;

    // remove crc and add mbap
    var buffer = new Buffer(data.length + MIN_MBAP_LENGTH - CRC_LENGTH);
    buffer.writeUInt16BE(transactionsId, 0);
    buffer.writeUInt16BE(0, 2);
    buffer.writeUInt16BE(data.length - CRC_LENGTH, 4);
    data.copy(buffer, MIN_MBAP_LENGTH);

    // send buffer to slave
    this._client.write(buffer);

    modbusSerialDebug({
        action: "send tcp rtu buffered port",
        data: data,
        buffer: buffer,
        unitid: this._id,
        functionCode: this._cmd
    });

    modbusSerialDebug(JSON.stringify({
        action: "send tcp rtu buffered port strings",
        data: data,
        buffer: buffer,
        unitid: this._id,
        functionCode: this._cmd
    }));
};

/**
 * TCP RTU bufferd port for Modbus.
 *
 * @type {TcpRTUBufferedPort}
 */
module.exports = TcpRTUBufferedPort;
