"use strict";
var util = require("util");
var events = require("events");
var EventEmitter = events.EventEmitter || events;
var net = require("net");
var modbusSerialDebug = require("debug")("modbus-serial");

/* TODO: const should be set once, maybe */
var EXCEPTION_LENGTH = 5;
var MIN_DATA_LENGTH = 6;

var TELNET_PORT = 2217;

/**
 * Simulate a modbus-RTU port using Telent connection.
 *
 * @param ip
 * @param options
 * @constructor
 */
var TelnetPort = function(ip, options) {
    var self = this;
    this.ip = ip;
    this.openFlag = false;
    this.callback = null;
    this._externalSocket = null;

    // options
    if(typeof ip === "object") {
        options = ip;
        this.ip = options.ip;
    }
    if (typeof options === "undefined") options = {};
    this.port = options.port || TELNET_PORT; // telnet server port

    // internal buffer
    this._buffer = Buffer.alloc(0);
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

    if(options.socket) {
        if(options.socket instanceof net.Socket) {
            this._externalSocket = options.socket;
            this.openFlag = this._externalSocket.readyState === "opening" || this._externalSocket.readyState === "open";
        } else {
            throw new Error("invalid socket provided");
        }
    }

    // create a socket
    this._client = this._externalSocket || new net.Socket();
    if (options.timeout) this._client.setTimeout(options.timeout);

    // register the port data event
    this._client.on("data", function onData(data) {
        // add data to buffer
        self._buffer = Buffer.concat([self._buffer, data]);

        // check if buffer include a complete modbus answer
        var expectedLength = self._length;
        var bufferLength = self._buffer.length;
        modbusSerialDebug(
            "on data expected length:" +
                expectedLength +
                " buffer length:" +
                bufferLength
        );

        modbusSerialDebug({
            action: "receive tcp telnet port",
            data: data,
            buffer: self._buffer
        });
        modbusSerialDebug(
            JSON.stringify({
                action: "receive tcp telnet port strings",
                data: data,
                buffer: self._buffer
            })
        );

        // check data length
        if (expectedLength < 6 || bufferLength < EXCEPTION_LENGTH) return;

        // loop and check length-sized buffer chunks
        var maxOffset = bufferLength - EXCEPTION_LENGTH;
        for (var i = 0; i <= maxOffset; i++) {
            var unitId = self._buffer[i];
            var functionCode = self._buffer[i + 1];

            if (unitId !== self._id) continue;

            if (
                functionCode === self._cmd &&
                i + expectedLength <= bufferLength
            ) {
                self._emitData(i, expectedLength);
                return;
            }
            if (
                functionCode === (0x80 | self._cmd) &&
                i + EXCEPTION_LENGTH <= bufferLength
            ) {
                self._emitData(i, EXCEPTION_LENGTH);
                return;
            }

            // frame header matches, but still missing bytes pending
            if (functionCode === (0x7f & self._cmd)) break;
        }
    });

    this._client.on("connect", function() {
        self.openFlag = true;
        handleCallback();
    });

    this._client.on("close", function(had_error) {
        self.openFlag = false;
        handleCallback(had_error);
        self.emit("close");
    });

    this._client.on("error", function(had_error) {
        self.openFlag = false;
        handleCallback(had_error);
    });

    this._client.on("timeout", function() {
        // modbus.openFlag is left in its current state as it reflects two types of timeouts,
        // i.e. 'false' for "TCP connection timeout" and 'true' for "Modbus response timeout"
        // (this allows to continue Modbus request re-tries without reconnecting TCP).
        modbusSerialDebug("TelnetPort port: TimedOut");
        handleCallback(new Error("TelnetPort Connection Timed Out."));
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
util.inherits(TelnetPort, EventEmitter);

/**
 * Emit the received response, cut the buffer and reset the internal vars.
 *
 * @param {number} start the start index of the response within the buffer
 * @param {number} length the length of the response
 * @private
 */
TelnetPort.prototype._emitData = function(start, length) {
    this.emit("data", this._buffer.slice(start, start + length));
    this._buffer = this._buffer.slice(start + length);

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
TelnetPort.prototype.open = function(callback) {
    if(this._externalSocket === null) {
        this.callback = callback;
        this._client.connect(this.port, this.ip);
    } else if(this.openFlag) {
        modbusSerialDebug("telnet port: external socket is opened");
        callback(); // go ahead to setup existing socket
    } else {
        callback(new Error("telnet port: external socket is not opened"));
    }
};

/**
 * Simulate successful close port.
 *
 * @param callback
 */
TelnetPort.prototype.close = function(callback) {
    this.callback = callback;
    this._client.end();
    this.removeAllListeners();
};

/**
 * Simulate successful destroy port.
 *
 * @param callback
 */
TelnetPort.prototype.destroy = function(callback) {
    this.callback = callback;
    if (!this._client.destroyed) {
        this._client.destroy();
    }
};

/**
 * Send data to a modbus slave via telnet server.
 *
 * @param {Buffer} data
 */
TelnetPort.prototype.write = function(data) {
    if (data.length < MIN_DATA_LENGTH) {
        modbusSerialDebug(
            "expected length of data is to small - minimum is " +
                MIN_DATA_LENGTH
        );
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

    // send buffer to slave
    this._client.write(data);

    modbusSerialDebug({
        action: "send tcp telnet port",
        data: data,
        unitid: this._id,
        functionCode: this._cmd
    });

    modbusSerialDebug(
        JSON.stringify({
            action: "send tcp telnet port strings",
            data: data,
            unitid: this._id,
            functionCode: this._cmd
        })
    );
};

/**
 * Telnet port for Modbus.
 *
 * @type {TelnetPort}
 */
module.exports = TelnetPort;
