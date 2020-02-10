"use strict";
var util = require("util");
var events = require("events");
var EventEmitter = events.EventEmitter || events;
var dgram = require("dgram");
var modbusSerialDebug = require("debug")("modbus-serial");

var crc16 = require("../utils/crc16");

/* TODO: const should be set once, maybe */
var MODBUS_PORT = 502; // modbus port
var MAX_TRANSACTIONS = 256; // maximum transaction to wait for
var MIN_DATA_LENGTH = 6;
var MIN_MBAP_LENGTH = 6;
var CRC_LENGTH = 2;

/**
 * Simulate a modbus-RTU port using modbus-udp.
 *
 * @param ip
 * @param options
 * @constructor
 */
var ModbusUdpPort = function(ip, options) {
    var modbus = this;
    this.ip = ip;
    this.openFlag = false;
    this._transactionIdWrite = 1;
    this.port = options.port || MODBUS_PORT;

    // options
    if (typeof(options) === "undefined") options = {};

    // create a socket
    this._client = dgram.createSocket("udp4");

    // Bind to the same port as we're sending to
    this._client.bind();

    // wait for answer
    const self = this;
    this._client.on("message", function(data, rinfo) {
        var buffer;
        var crc;
        var length;

        // Filter stuff not intended for us
        if(rinfo.address !== self.ip || rinfo.port !== self.port)
        {
            return;
        }

        // data received
        modbusSerialDebug({ action: "receive udp port strings", data: data });

        // check data length
        while (data.length > MIN_MBAP_LENGTH) {
            // parse udp header length
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
            modbusSerialDebug({ action: "parsed udp port", buffer: buffer, transactionId: modbus._transactionIdRead });

            // reset data
            data = data.slice(length + MIN_MBAP_LENGTH);
        }
    });

    this._client.on("listening", function() {
        modbus.openFlag = true;
    });

    this._client.on("close", function() {
        modbus.openFlag = false;
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
util.inherits(ModbusUdpPort, EventEmitter);

/**
 * Simulate successful port open.
 *
 * @param callback
 */
ModbusUdpPort.prototype.open = function(callback) {
    if (callback)
        callback(null);
};

/**
 * Simulate successful close port.
 *
 * @param callback
 */
ModbusUdpPort.prototype.close = function(callback) {
    this._client.close();
    if (callback)
        callback(null);
};

/**
 * Send data to a modbus-udp slave.
 *
 * @param data
 */
ModbusUdpPort.prototype.write = function(data) {
    if(data.length < MIN_DATA_LENGTH) {
        modbusSerialDebug("expected length of data is too small - minimum is " + MIN_DATA_LENGTH);
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
        action: "send modbus udp port",
        data: data,
        buffer: buffer,
        unitid: this._id,
        functionCode: this._cmd
    });

    // send buffer via udp
    this._client.send(buffer, 0, buffer.length, this.port, this.ip);

    // set next transaction id
    this._transactionIdWrite = (this._transactionIdWrite + 1) % MAX_TRANSACTIONS;

};

/**
 * UDP port for Modbus.
 *
 * @type {ModbusUdpPort}
 */
module.exports = ModbusUdpPort;
