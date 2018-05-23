"use strict";
var util = require("util");
var events = require("events");
var EventEmitter = events.EventEmitter || events;
var dgram = require("dgram");
var modbusSerialDebug = require("debug")("modbus-serial");

var crc16 = require("../utils/crc16");

/* TODO: const should be set once, maybe */
var MIN_DATA_LENGTH = 6;

var C701_PORT = 0x7002;

/**
 * Check if a buffer chunk can be a Modbus answer or modbus exception.
 *
 * @param {UdpPort} modbus
 * @param {Buffer} buf the buffer to check.
 * @return {boolean} if the buffer can be an answer
 * @private
 */
function _checkData(modbus, buf) {
    // check buffer size
    if (buf.length !== modbus._length && buf.length !== 5) return false;

    // calculate crc16
    var crcIn = buf.readUInt16LE(buf.length - 2);

    // check buffer unit-id, command and crc
    return (buf[0] === modbus._id &&
        (0x7f & buf[1]) === modbus._cmd &&
        crcIn === crc16(buf.slice(0, -2)));
}

/**
 * Simulate a modbus-RTU port using C701 UDP-to-Serial bridge.
 *
 * @param ip
 * @param options
 * @constructor
 */
var UdpPort = function(ip, options) {
    var modbus = this;
    this.ip = ip;
    this.openFlag = false;

    // options
    if (typeof(options) === "undefined") options = {};
    this.port = options.port || C701_PORT; // C701 port

    // create a socket
    this._client = dgram.createSocket("udp4");

    // wait for answer
    this._client.on("message", function(data) {
        var buffer = null;

        // check expected length
        if (modbus.length < 6) return;

        // check message length
        if (data.length < (116 + 5)) return;

        // check the C701 packet magic
        if (data.readUInt16LE(2) !== 602) return;

        // check for modbus valid answer
        // get the serial data from the C701 packet
        buffer = data.slice(data.length - modbus._length);

        modbusSerialDebug({ action: "receive c701 upd port", data: data, buffer: buffer });
        modbusSerialDebug(JSON.stringify({ action: "receive c701 upd port strings", data: data, buffer: buffer }));

        // check the serial data
        if (_checkData(modbus, buffer)) {
            modbusSerialDebug({ action: "emit data serial rtu buffered port", buffer: buffer });
            modbusSerialDebug(JSON.stringify({ action: "emit data serial rtu buffered port strings", buffer: buffer }));

            modbus.emit("data", buffer);
        } else {
            // check for modbus exception
            // get the serial data from the C701 packet
            buffer = data.slice(data.length - 5);

            // check the serial data
            if (_checkData(modbus, buffer)) {
                modbusSerialDebug({ action: "emit data serial rtu buffered port", buffer: buffer });
                modbusSerialDebug(JSON.stringify({
                    action: "emit data serial rtu buffered port strings",
                    buffer: buffer
                }));

                modbus.emit("data", buffer);
            }
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
util.inherits(UdpPort, EventEmitter);

/**
 * Simulate successful port open.
 *
 * @param callback
 */
UdpPort.prototype.open = function(callback) {
    if (callback)
        callback(null);
};

/**
 * Simulate successful close port.
 *
 * @param callback
 */
UdpPort.prototype.close = function(callback) {
    this._client.close();
    if (callback)
        callback(null);
};

/**
 * Send data to a modbus-tcp slave.
 *
 * @param data
 */
UdpPort.prototype.write = function(data) {
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
        default:
            // raise and error ?
            this._length = 0;
            break;
    }

    // build C701 header
    var buffer = Buffer.alloc(data.length + 116);
    buffer.fill(0);
    buffer.writeUInt16LE(600, 2);           // C701 magic for serial bridge
    buffer.writeUInt16LE(0, 36);            // C701 RS485 connector (0..2)
    buffer.writeUInt16LE(this._length, 38); // expected serial answer length
    buffer.writeUInt16LE(1, 102);           // C7011 RS481 hub (1..2)
    buffer.writeUInt16LE(data.length, 104); // serial data length

    // add serial line data
    data.copy(buffer, 116);

    // send buffer to C701 UDP to serial bridge
    this._client.send(buffer, 0, buffer.length, this.port, this.ip);

    modbusSerialDebug({
        action: "send c701 upd port",
        data: data,
        buffer: buffer,
        unitid: this._id,
        functionCode: this._cmd
    });

    modbusSerialDebug(JSON.stringify({
        action: "send c701 upd port strings",
        data: data,
        buffer: buffer,
        unitid: this._id,
        functionCode: this._cmd
    }));
};

/**
 * UDP port for Modbus.
 *
 * @type {UdpPort}
 */
module.exports = UdpPort;
