"use strict";
var util = require("util");
var events = require("events");
var EventEmitter = events.EventEmitter || events;


/**
 * Mock for SerialPort
 */
var SerialPortMock = function(path, options, callback) {
    EventEmitter.call(this);
    this._openFlag = false;
    if (callback) {
        callback(null);
    }

    Object.defineProperty(this, "isOpen", {
        enumerable: true,
        get: function() {
            return this._openFlag;
        }
    });
};
util.inherits(SerialPortMock, EventEmitter);

SerialPortMock.prototype.open = function(callback) {
    this._openFlag = true;
    if (callback) {
        callback(null);
    }
    this.emit("open");
};

SerialPortMock.prototype.write = function(buffer, callback) {
    this._data = buffer;
    if (callback) {
        callback(null);
    }
};

SerialPortMock.prototype.close = function(callback) {
    this._openFlag = false;
    if (callback) {
        callback(null);
    }
    this.emit("close");
};

SerialPortMock.prototype.receive = function(buffer) {
    this.emit("data", buffer);
};

module.exports = SerialPortMock;
