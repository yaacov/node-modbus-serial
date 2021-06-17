"use strict";
var util = require("util");
var events = require("events");
var EventEmitter = events.EventEmitter || events;
var net = require("net");
var modbusSerialDebug = require("debug")("modbus-serial");

var crc16 = require("../utils/crc16");

/* TODO: const should be set once, maybe */
var MODBUS_PORT = 502; // modbus port
var MAX_TRANSACTIONS = 256; // maximum transaction to wait for
var MIN_DATA_LENGTH = 6;
var MIN_MBAP_LENGTH = 6;
var CRC_LENGTH = 2;

/**
 * Simulate a modbus-RTU port using modbus-TCP connection.
 *
 * @param ip
 * @param options
 *   options.port: Nonstandard Modbus port (default is 502).
 *   options.localAddress: Local IP address to bind to, default is any.
 *   options.family: 4 = IPv4-only, 6 = IPv6-only, 0 = either (default).
 * @constructor
 */
var TcpPort = function(ip, options) {
    var modbus = this;
    this.openFlag = false;
    this.callback = null;
    this._transactionIdWrite = 1;
    this._externalSocket = null;

    if(typeof ip === "object") {
        options = ip;
    }

    if (typeof(options) === "undefined") options = {};

    this.connectOptions = {
        host: ip || options.ip,
        port: options.port || MODBUS_PORT,
        localAddress: options.localAddress,
        family: options.family
    };

    if(options.socket) {
        if(options.socket instanceof net.Socket) {
            this._externalSocket = options.socket;
            this.openFlag = this._externalSocket.readyState === "opening" || this._externalSocket.readyState === "open";
        } else {
            throw new Error("invalid socket provided");
        }
    }

    // handle callback - call a callback function only once, for the first event
    // it will triger
    var handleCallback = function(had_error) {
        if (modbus.callback) {
            modbus.callback(had_error);
            modbus.callback = null;
        }
    };

    // init a socket
    this._client = this._externalSocket || new net.Socket();

    if (options.timeout) this._client.setTimeout(options.timeout);
    this._client.on("data", function(data) {
        var buffer;
        var crc;
        var length;

        // data recived
        modbusSerialDebug({ action: "receive tcp port strings", data: data });

        // check data length
        while (data.length > MIN_MBAP_LENGTH) {
            // parse tcp header length
            length = data.readUInt16BE(4);

            // cut 6 bytes of mbap and copy pdu
            buffer = Buffer.alloc(length + CRC_LENGTH);
            data.copy(buffer, 0, MIN_MBAP_LENGTH);

            // add crc to message
            crc = crc16(buffer.slice(0, -CRC_LENGTH));
            buffer.writeUInt16LE(crc, buffer.length - CRC_LENGTH);

            // update transaction id and emit data
            modbus._transactionIdRead = data.readUInt16BE(0);
            modbus.emit("data", buffer);

            // debug
            modbusSerialDebug({ action: "parsed tcp port", buffer: buffer, transactionId: modbus._transactionIdRead });

            // reset data
            data = data.slice(length + MIN_MBAP_LENGTH);
        }
    });

    this._client.on("connect", function() {
        modbus.openFlag = true;
        modbusSerialDebug("TCP port: signal connect");
        handleCallback();
    });

    this._client.on("close", function(had_error) {
        modbus.openFlag = false;
        modbusSerialDebug("TCP port: signal close: " + had_error);
        handleCallback(had_error);

        modbus.emit("close");
        modbus.removeAllListeners();
    });

    this._client.on("error", function(had_error) {
        modbus.openFlag = false;
        modbusSerialDebug("TCP port: signal error: " + had_error);
        handleCallback(had_error);
    });

    this._client.on("timeout", function() {
        // modbus.openFlag is left in its current state as it reflects two types of timeouts,
        // i.e. 'false' for "TCP connection timeout" and 'true' for "Modbus response timeout"
        // (this allows to continue Modbus request re-tries without reconnecting TCP).
        modbusSerialDebug("TCP port: TimedOut");
        handleCallback(new Error("TCP Connection Timed Out"));
    });

    /**
     * Check if port is open.
     *
     * @returns {boolean}
     */
    Object.defineProperty(this, "isOpen", {
        enumerable: true,
        get: function() {
            return this.openFlag;
        }
    });

    EventEmitter.call(this);
};
util.inherits(TcpPort, EventEmitter);

/**
 * Simulate successful port open.
 *
 * @param callback
 */
TcpPort.prototype.open = function(callback) {
    if(this._externalSocket === null) {
        this.callback = callback;
        this._client.connect(this.connectOptions);
    } else if(this.openFlag) {
        modbusSerialDebug("TCP port: external socket is opened");
        callback(); // go ahead to setup existing socket
    } else {
        callback(new Error("TCP port: external socket is not opened"));
    }
};

/**
 * Simulate successful close port.
 *
 * @param callback
 */
TcpPort.prototype.close = function(callback) {
    this.callback = callback;
    // DON'T pass callback to `end()` here, it will be handled by client.on('close') handler
    this._client.end();

    this.removeAllListeners();
};

/**
 * Simulate successful destroy port.
 *
 * @param callback
 */
TcpPort.prototype.destroy = function(callback) {
    this.callback = callback;
    if (!this._client.destroyed) {
        this._client.destroy();
    }
};

/**
 * Send data to a modbus-tcp slave.
 *
 * @param data
 */
TcpPort.prototype.write = function(data) {
    if(data.length < MIN_DATA_LENGTH) {
        modbusSerialDebug("expected length of data is to small - minimum is " + MIN_DATA_LENGTH);
        return;
    }

    // remember current unit and command
    this._id = data[0];
    this._cmd = data[1];

    // remove crc and add mbap
    var buffer = Buffer.alloc(data.length + MIN_MBAP_LENGTH - CRC_LENGTH);
    buffer.writeUInt16BE(this._transactionIdWrite, 0);
    buffer.writeUInt16BE(0, 2);
    buffer.writeUInt16BE(data.length - CRC_LENGTH, 4);
    data.copy(buffer, MIN_MBAP_LENGTH);

    modbusSerialDebug({
        action: "send tcp port",
        data: data,
        buffer: buffer,
        unitid: this._id,
        functionCode: this._cmd,
        transactionsId: this._transactionIdWrite
    });

    // send buffer to slave
    this._client.write(buffer);

    // set next transaction id
    this._transactionIdWrite = (this._transactionIdWrite + 1) % MAX_TRANSACTIONS;
};

/**
 * TCP port for Modbus.
 *
 * @type {TcpPort}
 */
module.exports = TcpPort;
