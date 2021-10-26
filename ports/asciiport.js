"use strict";
/* eslint-disable no-ternary */

var util = require("util");
var events = require("events");
var EventEmitter = events.EventEmitter || events;
var SerialPort = require("serialport");
var modbusSerialDebug = require("debug")("modbus-serial");

var crc16 = require("../utils/crc16");
var calculateLrc = require("./../utils/lrc");

/* TODO: const should be set once, maybe */
var MIN_DATA_LENGTH = 6;

/**
 * Ascii encode a 'request' buffer and return it. This includes removing
 * the CRC bytes and replacing them with an LRC.
 *
 * @param {Buffer} buf the data buffer to encode.
 * @return {Buffer} the ascii encoded buffer
 * @private
 */
function _asciiEncodeRequestBuffer(buf) {

    // replace the 2 byte crc16 with a single byte lrc
    buf.writeUInt8(calculateLrc(buf.slice(0, -2)), buf.length - 2);

    // create a new buffer of the correct size
    var bufAscii = Buffer.alloc(buf.length * 2 + 1); // 1 byte start delimit + x2 data as ascii encoded + 2 lrc + 2 end delimit

    // create the ascii payload

    // start with the single start delimiter
    bufAscii.write(":", 0);
    // encode the data, with the new single byte lrc
    bufAscii.write(buf.toString("hex", 0, buf.length - 1).toUpperCase(), 1);
    // end with the two end delimiters
    bufAscii.write("\r", bufAscii.length - 2);
    bufAscii.write("\n", bufAscii.length - 1);

    return bufAscii;
}

/**
 * Ascii decode a 'response' buffer and return it.
 *
 * @param {Buffer} bufAscii the ascii data buffer to decode.
 * @return {Buffer} the decoded buffer, or null if decode error
 * @private
 */
function _asciiDecodeResponseBuffer(bufAscii) {

    // create a new buffer of the correct size (based on ascii encoded buffer length)
    var bufDecoded = Buffer.alloc((bufAscii.length - 1) / 2);

    // decode into new buffer (removing delimiters at start and end)
    for (var i = 0; i < (bufAscii.length - 3) / 2; i++) {
        bufDecoded.write(String.fromCharCode(bufAscii.readUInt8(i * 2 + 1), bufAscii.readUInt8(i * 2 + 2)), i, 1, "hex");
    }

    // check the lrc is true
    var lrcIn = bufDecoded.readUInt8(bufDecoded.length - 2);
    if(calculateLrc(bufDecoded.slice(0, -2)) !== lrcIn) {
        // return null if lrc error
        var calcLrc = calculateLrc(bufDecoded.slice(0, -2));

        modbusSerialDebug({ action: "LRC error", LRC: lrcIn.toString(16), calcLRC: calcLrc.toString(16) });
        return null;
    }

    // replace the 1 byte lrc with a two byte crc16
    bufDecoded.writeUInt16LE(crc16(bufDecoded.slice(0, -2)), bufDecoded.length - 2);

    return bufDecoded;
}

/**
 * check if a buffer chunk can be a modbus answer
 * or modbus exception
 *
 * @param {AsciiPort} modbus
 * @param {Buffer} buf the buffer to check.
 * @return {boolean} if the buffer can be an answer
 * @private
 */
function _checkData(modbus, buf) {
    // check buffer size
    if (buf.length !== modbus._length && buf.length !== 5) {
        modbusSerialDebug({ action: "length error", recive: buf.length, expected: modbus._length });

        return false;
    }

    // check buffer unit-id and command
    return (buf[0] === modbus._id &&
        (0x7f & buf[1]) === modbus._cmd);
}

/**
 * Simulate a modbus-ascii port using serial connection.
 *
 * @param path
 * @param options
 * @constructor
 */
var AsciiPort = function(path, options) {
    var modbus = this;

    // options
    options = options || {};

    // select char for start of slave frame (usually :)
    this._startOfSlaveFrameChar =
        (options.startOfSlaveFrameChar === undefined)
            ? 0x3A
            : options.startOfSlaveFrameChar;

    // disable auto open, as we handle the open
    options.autoOpen = false;

    // internal buffer
    this._buffer = Buffer.from("");
    this._id = 0;
    this._cmd = 0;
    this._length = 0;

    // create the SerialPort
    this._client = new SerialPort(path, options);

    // register the port data event
    this._client.on("data", function(data) {

        // add new data to buffer
        modbus._buffer = Buffer.concat([modbus._buffer, data]);

        modbusSerialDebug({ action: "receive serial ascii port", data: data, buffer: modbus._buffer });
        modbusSerialDebug(JSON.stringify({ action: "receive serial ascii port strings", data: data, buffer: modbus._buffer }));

        // check buffer for start delimiter
        var sdIndex = modbus._buffer.indexOf(modbus._startOfSlaveFrameChar);
        if(sdIndex === -1) {
            // if not there, reset the buffer and return
            modbus._buffer = Buffer.from("");
            return;
        }
        // if there is data before the start delimiter, remove it
        if(sdIndex > 0) {
            modbus._buffer = modbus._buffer.slice(sdIndex);
        }
        // do we have the complete message (i.e. are the end delimiters there)
        if(modbus._buffer.includes("\r\n", 1, "ascii") === true) {
            // check there is no excess data after end delimiters
            var edIndex = modbus._buffer.indexOf(0x0A); // ascii for '\n'
            if(edIndex !== modbus._buffer.length - 1) {
                // if there is, remove it
                modbus._buffer = modbus._buffer.slice(0, edIndex + 1);
            }

            // we have what looks like a complete ascii encoded response message, so decode
            var _data = _asciiDecodeResponseBuffer(modbus._buffer);
            modbusSerialDebug({ action: "got EOM", data: _data, buffer: modbus._buffer });
            if(_data !== null) {

                // check if this is the data we are waiting for
                if (_checkData(modbus, _data)) {
                    modbusSerialDebug({ action: "emit data serial ascii port", data: data, buffer: modbus._buffer });
                    modbusSerialDebug(JSON.stringify({ action: "emit data serial ascii port strings", data: data, buffer: modbus._buffer }));
                    // emit a data signal
                    modbus.emit("data", _data);
                }
            }
            // reset the buffer now its been used
            modbus._buffer = Buffer.from("");
        } else {
            // otherwise just wait for more data to arrive
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
util.inherits(AsciiPort, EventEmitter);

/**
 * Simulate successful port open.
 *
 * @param callback
 */
AsciiPort.prototype.open = function(callback) {
    this._client.open(callback);
};

/**
 * Simulate successful close port.
 *
 * @param callback
 */
AsciiPort.prototype.close = function(callback) {
    this._client.close(callback);
    this.removeAllListeners();
};

/**
 * Send data to a modbus slave.
 *
 * @param data
 */
AsciiPort.prototype.write = function(data) {
    if(data.length < MIN_DATA_LENGTH) {
        modbusSerialDebug("expected length of data is to small - minimum is " + MIN_DATA_LENGTH);
        return;
    }

    var length = null;

    // remember current unit and command
    this._id = data[0];
    this._cmd = data[1];

    // calculate expected answer length (this is checked after ascii decoding)
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
            modbusSerialDebug({ action: "unknown command", id: this._id.toString(16), command: this._cmd.toString(16) });
            this._length = 0;
            break;
    }

    // ascii encode buffer
    var _encodedData = _asciiEncodeRequestBuffer(data);

    // send buffer to slave
    this._client.write(_encodedData);

    modbusSerialDebug({
        action: "send serial ascii port",
        data: _encodedData,
        unitid: this._id,
        functionCode: this._cmd
    });

    modbusSerialDebug(JSON.stringify({
        action: "send serial ascii port",
        data: _encodedData,
        unitid: this._id,
        functionCode: this._cmd
    }));
};

/**
 * ASCII port for Modbus.
 *
 * @type {AsciiPort}
 */
module.exports = AsciiPort;
