"use strict";
const events = require("events");
const EventEmitter = events.EventEmitter || events;
const SerialPort = require("serialport").SerialPort;
const modbusSerialDebug = require("debug")("modbus-serial");
const { reportServerIdLength, readDeviceIdentificationLength } = require("../utils/response_length");

/* TODO: const should be set once, maybe */
const EXCEPTION_LENGTH = 5;
const MIN_DATA_LENGTH = 6;
const MIN_WRITE_DATA_LENGTH = 4;
const MAX_BUFFER_LENGTH = 256;
const READ_DEVICE_IDENTIFICATION_FUNCTION_CODE = 43;
const REPORT_SERVER_ID_FUNCTION_CODE = 17;
const LENGTH_UNKNOWN = "unknown";

class RTUBufferedPort extends EventEmitter {
    /**
     * Simulate a modbus-RTU port using buffered serial connection.
     *
     * @param path
     * @param options
     * @constructor
     */
    constructor(path, options) {
        super();

        const self = this;

        // options
        if (typeof(options) === "undefined") options = {};

        // disable auto open, as we handle the open
        options.autoOpen = false;

        // internal buffer
        this._buffer = Buffer.alloc(0);
        this._id = 0;
        this._cmd = 0;
        this._length = 0;

        // create the SerialPort
        this._client = new SerialPort(Object.assign({}, { path }, options));

        // attach an error listener on the SerialPort object
        this._client.on("error", function(error) {
            self.emit("error", error);
        });

        // attach a close listener on the SerialPort object
        this._client.on("close", function() {
            self.emit("close");
        });

        // register the port data event
        this._client.on("data", function onData(data) {
            // add data to buffer
            self._buffer = Buffer.concat([self._buffer, data]);

            modbusSerialDebug({ action: "receive serial rtu buffered port", data: data, buffer: self._buffer });

            // check if buffer include a complete modbus answer
            const expectedLength = self._length;
            let bufferLength = self._buffer.length;


            // check data length
            if (expectedLength !== LENGTH_UNKNOWN &&
                expectedLength < MIN_DATA_LENGTH ||
                bufferLength < EXCEPTION_LENGTH
            ) { return; }

            // check buffer size for MAX_BUFFER_SIZE
            if (bufferLength > MAX_BUFFER_LENGTH) {
                self._buffer = self._buffer.slice(-MAX_BUFFER_LENGTH);
                bufferLength = MAX_BUFFER_LENGTH;
            }

            // loop and check length-sized buffer chunks
            const maxOffset = bufferLength - EXCEPTION_LENGTH;

            for (let i = 0; i <= maxOffset; i++) {
                const unitId = self._buffer[i];
                const functionCode = self._buffer[i + 1];

                if (unitId !== self._id) continue;

                if (functionCode === self._cmd && functionCode === READ_DEVICE_IDENTIFICATION_FUNCTION_CODE) {
                    const responseLength = readDeviceIdentificationLength(self._buffer, i);
                    if (responseLength !== null && i + responseLength <= bufferLength) {
                        self._emitData(i, responseLength);
                        return;
                    }
                } else if (functionCode === self._cmd && functionCode === REPORT_SERVER_ID_FUNCTION_CODE) {
                    const responseLength = reportServerIdLength(self._buffer, i);
                    if (responseLength !== null && i + responseLength <= bufferLength) {
                        self._emitData(i, responseLength);
                        return;
                    }
                } else {
                    if (functionCode === self._cmd && i + expectedLength <= bufferLength) {
                        self._emitData(i, expectedLength);
                        return;
                    }
                    if (functionCode === (0x80 | self._cmd) && i + EXCEPTION_LENGTH <= bufferLength) {
                        self._emitData(i, EXCEPTION_LENGTH);
                        return;
                    }
                }

                // frame header matches, but still missing bytes pending
                if (functionCode === (0x7f & self._cmd)) break;
            }
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
     * Emit the received response, cut the buffer and reset the internal vars.
     *
     * @param {number} start The start index of the response within the buffer.
     * @param {number} length The length of the response.
     * @private
     */
    _emitData(start, length) {
        const buffer = this._buffer.slice(start, start + length);
        modbusSerialDebug({ action: "emit data serial rtu buffered port", buffer: buffer });
        this.emit("data", buffer);
        this._buffer = this._buffer.slice(start + length);
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
        this.removeAllListeners("data");
    }

    /**
     * Send data to a modbus slave.
     *
     * @param {Buffer} data
     */
    write(data) {
        if(data.length < MIN_WRITE_DATA_LENGTH) {
            modbusSerialDebug("expected length of data is to small - minimum is " + MIN_WRITE_DATA_LENGTH);
            return;
        }

        let length;

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
            case 17:
                // response is device specific
                this._length = LENGTH_UNKNOWN;
                break;
            case 43:
                // this function is super special
                // you know the format of the code response
                // and you need to continuously check that all of the data has arrived before emitting
                // see onData for more info.
                this._length = LENGTH_UNKNOWN;
                break;
            default:
                // raise and error ?
                this._length = 0;
                break;
        }

        // send buffer to slave
        this._client.write(data);

        modbusSerialDebug({
            action: "send serial rtu buffered",
            data: data,
            unitid: this._id,
            functionCode: this._cmd,
            length: this._length
        });
    }
}

/**
 * RTU buffered port for Modbus.
 *
 * @type {RTUBufferedPort}
 */
module.exports = RTUBufferedPort;
