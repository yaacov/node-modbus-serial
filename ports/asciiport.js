"use strict";

const events = require("events");
const EventEmitter = events.EventEmitter || events;
const SerialPort = require("serialport").SerialPort;
const modbusSerialDebug = require("debug")("modbus-serial");

const ascii = require("../utils/ascii");

/* TODO: const should be set once, maybe */
const MIN_DATA_LENGTH = 6;

class AsciiPort extends EventEmitter {
    /**
     * Simulate a modbus-ascii port using serial connection.
     *
     * @param path
     * @param options
     * @constructor
     */
    constructor(path, options) {
        super();

        const modbus = this;

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
        this._client = new SerialPort(Object.assign({}, { path }, options));

        // register the port data event
        this._client.on("data", function(data) {
            ascii.handleData(modbus, data);
        });
    }

    /**
     * Check if port is open.
     *
     * @returns {boolean}
     */
    get isOpen() {
        return this._client.isOpen;
    }

    /**
     * Simulate successful port open.
     *
     * @param callback
     */
    open(callback) {
        this._client.open(callback);
    }

    /**
     * Simulate successful close port.
     *
     * @param callback
     */
    close(callback) {
        this._client.close(callback);
        this.removeAllListeners();
    }

    /**
     * Send data to a modbus slave.
     *
     * @param data
     */
    write(data) {
        if(data.length < MIN_DATA_LENGTH) {
            modbusSerialDebug("expected length of data is to small - minimum is " + MIN_DATA_LENGTH);
            return;
        }

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
    }
}

/**
 * ASCII port for Modbus.
 *
 * @type {AsciiPort}
 */
module.exports = AsciiPort;
