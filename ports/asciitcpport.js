"use strict";
const events = require("events");
const EventEmitter = events.EventEmitter || events;
const net = require("net");
const modbusSerialDebug = require("debug")("modbus-serial");

const ascii = require("../utils/ascii");

/* TODO: const should be set once, maybe */
const MIN_DATA_LENGTH = 6;

const MODBUS_PORT = 502;

class AsciiTcpPort extends EventEmitter {
    /**
     * Simulate a modbus-ascii port using TCP connection, e.g. a serial to
     * ethernet gateway in transparent (raw TCP) mode.
     * @module AsciiTcpPort
     *
     * @param {string} ip - ip address
     * @param {object} options - all options as JSON object
     *   options.port: Nonstandard Modbus port (default is 502).
     *   options.localAddress: Local IP address to bind to, default is any.
     *   options.family: 4 = IPv4-only, 6 = IPv6-only, 0 = either (default).
     *   options.timeout: socket timeout in milliseconds.
     *   options.socket: an existing net.Socket to use.
     *   options.startOfSlaveFrameChar: char for start of slave frame (default is ':').
     * @constructor
     */
    constructor(ip, options) {
        super();

        const modbus = this;
        modbus.openFlag = false;
        modbus.callback = null;
        this._externalSocket = null;

        // options
        if(typeof ip === "object") {
            options = ip;
            ip = undefined;
        }
        if (typeof options === "undefined") options = {};
        modbus.connectOptions = {
            host: ip || options.ip,
            port: options.port || MODBUS_PORT,
            localAddress: options.localAddress,
            family: options.family || 0
        };

        // select char for start of slave frame (usually :)
        this._startOfSlaveFrameChar =
            (options.startOfSlaveFrameChar === undefined)
                ? 0x3A
                : options.startOfSlaveFrameChar;

        if(options.socket) {
            if(options.socket instanceof net.Socket) {
                this._externalSocket = options.socket;
                this.openFlag = this._externalSocket.readyState === "opening" || this._externalSocket.readyState === "open";
            } else {
                throw new Error("invalid socket provided");
            }
        }

        // internal buffer
        this._buffer = Buffer.from("");
        this._id = 0;
        this._cmd = 0;
        this._length = 0;

        // handle callback - call a callback function only once, for the first event
        // it will trigger
        const handleCallback = function(had_error) {
            if (modbus.callback) {
                modbus.callback(had_error);
                modbus.callback = null;
            }
        };

        // create a socket
        this._client = this._externalSocket || new net.Socket();
        if (options.timeout) this._client.setTimeout(options.timeout);

        // register the port data event
        this._client.on("data", function onData(data) {
            ascii.handleData(modbus, data);
        });

        this._client.on("connect", function() {
            modbus.openFlag = true;
            handleCallback();
        });

        this._client.on("close", function(had_error) {
            if (modbus.openFlag) {
                modbus.openFlag = false;
                modbusSerialDebug("ASCII TCP port: signal close: " + had_error);
                handleCallback(had_error);

                modbus.emit("close");
                modbus.removeAllListeners();
            }
        });

        this._client.on("error", function(had_error) {
            modbus.openFlag = false;
            handleCallback(had_error);
        });

        this._client.on("timeout", function() {
            // modbus.openFlag is left in its current state as it reflects two types of timeouts,
            // i.e. 'false' for "TCP connection timeout" and 'true' for "Modbus response timeout"
            // (this allows to continue Modbus request re-tries without reconnecting TCP).
            modbusSerialDebug("AsciiTcpPort port: TimedOut");
            handleCallback(new Error("AsciiTcpPort Connection Timed Out"));
        });
    }

    /**
     * Check if port is open.
     *
     * @returns {boolean}
     */
    get isOpen() {
        return this.openFlag;
    }

    /**
     * Simulate successful port open.
     *
     * @param callback
     */
    open(callback) {
        if(this._externalSocket === null) {
            this.callback = callback;
            this._client.connect(this.connectOptions);
        } else if(this.openFlag) {
            modbusSerialDebug("ASCII TCP port: external socket is opened");
            callback(); // go ahead to setup existing socket
        } else {
            callback(new Error("ASCII TCP port: external socket is not opened"));
        }
    }

    /**
     * Simulate successful close port.
     *
     * @param callback
     */
    close(callback) {
        this.callback = callback;
        // DON'T pass callback to `end()` here, it will be handled by client.on('close') handler
        this._client.end();
    }

    /**
     * Simulate successful destroy port.
     *
     * @param callback
     */
    destroy(callback) {
        this.callback = callback;
        if (!this._client.destroyed) {
            this._client.destroy();
        }
    }

    /**
     * Send data to a modbus slave.
     *
     * @param {Buffer} data
     */
    write(data) {
        if(data.length < MIN_DATA_LENGTH) {
            modbusSerialDebug("expected length of data is to small - minimum is " + MIN_DATA_LENGTH);
            return;
        }

        // drop any stale data from a previous request
        this._buffer = Buffer.from("");

        // remember current unit and command
        this._id = data[0];
        this._cmd = data[1];

        // calculate expected answer length (this is checked after ascii decoding)
        this._length = ascii.expectedResponseLength(data);

        // ascii encode buffer
        const _encodedData = ascii.encodeRequestBuffer(data);

        // send buffer to slave
        this._client.write(_encodedData);

        modbusSerialDebug({
            action: "send tcp ascii port",
            data: _encodedData,
            unitid: this._id,
            functionCode: this._cmd
        });
    }
}

/**
 * ASCII over TCP port for Modbus.
 *
 * @type {AsciiTcpPort}
 */
module.exports = AsciiTcpPort;