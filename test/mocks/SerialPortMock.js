"use strict";
const events = require("events");
const EventEmitter = events.EventEmitter || events;

class SerialPortMock extends EventEmitter {
    /**
     * Mock for SerialPort
     */
    constructor(options, callback) {
        super();

        this._openFlag = false;
        if (callback) {
            callback(null);
        }
    }

    get isOpen() {
        return this._openFlag;
    }

    open(callback) {
        this._openFlag = true;
        if (callback) {
            callback(null);
        }
        this.emit("open");
    }

    write(buffer, callback) {
        this._data = buffer;
        if (callback) {
            callback(null);
        }
    }

    close(callback) {
        this._openFlag = false;
        if (callback) {
            callback(null);
        }
        this.emit("close");
    }

    receive(buffer) {
        this.emit("data", buffer);
    }
}

module.exports = { SerialPort: SerialPortMock };
