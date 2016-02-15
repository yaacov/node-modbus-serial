'use strict';
var util = require('util');
var events = require('events');
var net = require('net');

var crc16 = require('./../utils/crc16');

var MODBUS_PORT = 502; // modbus port

/**
 * Simulate a modbus-RTU port using modbus-TCP connection
 */
var TcpPort = function(ip, options) {
    var modbus = this;
    this.ip = ip;
    this.openFlag = false;

    // options
    if (typeof(options) == 'undefined') options = {};
    this.port = options.port || MODBUS_PORT; // modbus port

    // create a socket
    this._client = new net.Socket();
    this._client.on('data', function(data) {
        var buffer;
        var crc;

        // check data length
        if (data.length < 6) return;

        // cut 6 bytes of mbap, copy pdu and add crc
        buffer = new Buffer(data.length - 6 + 2);
        data.copy(buffer, 0, 6);
        crc = crc16(buffer.slice(0, -2));
        buffer.writeUInt16LE(crc, buffer.length - 2);

        // emit a data signal
        modbus.emit('data', buffer);
    });

    this._client.on('connect', function() {
        modbus.openFlag = true;
    });

    this._client.on('close', function(had_error) {
        modbus.openFlag = false;
    });

    events.call(this);
};
util.inherits(TcpPort, events);

/**
 * Simulate successful port open
 */
TcpPort.prototype.open = function (callback) {
    this._client.connect(this.port, this.ip, callback);
};

/**
 * Simulate successful close port
 */
TcpPort.prototype.close = function (callback) {
    this._client.end();
    if (callback)
        callback(null);
};

/**
 * Check if port is open
 */
TcpPort.prototype.isOpen = function() {
    return this.openFlag;
};

/**
 * Send data to a modbus-tcp slave
 */
TcpPort.prototype.write = function (data) {
    // remove crc and add mbap
    var buffer = new Buffer(data.length + 6 - 2);
    buffer.writeUInt16BE(1, 0);
    buffer.writeUInt16BE(0, 2);
    buffer.writeUInt16BE(data.length - 2, 4);
    data.copy(buffer, 6);

    // send buffer to slave
    this._client.write(buffer);
};

module.exports = TcpPort;
