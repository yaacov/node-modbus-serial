'use strict';
var util = require('util');
var events = require('events');
var EventEmitter = events.EventEmitter || events;
var net = require('net');
var modbusSerialDebug = require('debug')('modbus-serial');

var crc16 = require('../utils/crc16');

/* TODO: const should be set once, maybe */
var MODBUS_PORT = 502; // modbus port
var MAX_TRANSACTIONS = 64; // maximum transaction to wait for
var MIN_DATA_LENGTH = 6;
var MIN_MBAP_LENGTH = 6;
var CRC_LENGTH = 2;

/**
 * Simulate a modbus-RTU port using modbus-TCP connection
 */
var TcpPort = function(ip, options) {
    var modbus = this;
    this.ip = ip;
    this.openFlag = false;
    this.callback = null;

    // options
    if (typeof(options) == 'undefined') options = {};
    this.port = options.port || MODBUS_PORT; // modbus port

    // handle callback - call a callback function only once, for the first event
    // it will triger
    var handleCallback = function(had_error) {
        if (modbus.callback) {
            modbus.callback(had_error);
            modbus.callback = null;
        }
    }

    // create a socket
    this._client = new net.Socket();
    this._client.on('data', function(data) {
        var buffer;
        var crc;

        // check data length
        if (data.length < MIN_MBAP_LENGTH) return;

        // cut 6 bytes of mbap, copy pdu and add crc
        buffer = new Buffer(data.length - MIN_MBAP_LENGTH + CRC_LENGTH);
        data.copy(buffer, 0, MIN_MBAP_LENGTH);
        crc = crc16(buffer.slice(0, -CRC_LENGTH));
        buffer.writeUInt16LE(crc, buffer.length - CRC_LENGTH);

        // update transaction id
        modbus._transactionId = data.readUInt16BE(0);

        modbusSerialDebug({action: 'receive tcp port', data: data, buffer: buffer});
        modbusSerialDebug(JSON.stringify({action: 'receive tcp port strings', data: data, buffer: buffer}));

        // emit a data signal
        modbus.emit('data', buffer);
    });

    this._client.on('connect', function() {
        modbus.openFlag = true;
        handleCallback();
    });

    this._client.on('close', function(had_error) {
        modbus.openFlag = false;
        handleCallback(had_error);
    });

    this._client.on('error', function(had_error) {
        modbus.openFlag = false;
        handleCallback(had_error);
    });

    EventEmitter.call(this);
};
util.inherits(TcpPort, EventEmitter);

/**
 * Simulate successful port open
 */
TcpPort.prototype.open = function(callback) {
    this.callback = callback;
    this._client.connect(this.port, this.ip);
};

/**
 * Simulate successful close port
 */
TcpPort.prototype.close = function(callback) {
    this.callback = callback;
    this._client.end();
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
TcpPort.prototype.write = function(data) {
    if(data.length < MIN_DATA_LENGTH) {
        modbusSerialDebug('expected length of data is to small - minimum is ' + MIN_DATA_LENGTH);
        return;
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

    modbusSerialDebug({action: 'send tcp port', data: data, buffer: buffer});
    modbusSerialDebug(JSON.stringify({action: 'send tcp port strings', data: data, buffer: buffer}));
};

module.exports = TcpPort;
