'use strict';
var util = require('util');
var EventEmitter = require('events');


/**
 * Mock for SerialPort
 */
var SerialPortMock = function(path, options, openImmediately, callback) {
    EventEmitter.call(this);
    this._openFlag = openImmediately;
    if (callback) {
        callback(null);
    }
};
util.inherits(SerialPortMock, EventEmitter);

SerialPortMock.prototype.open = function (callback) {
    this._openFlag = true;
    if (callback) {
        callback(null);
    }
    this.emit('open');
};

SerialPortMock.prototype.isOpen = function() {
    return this._openFlag;
};

SerialPortMock.prototype.write = function(buffer, callback) {
    this._data = buffer;
    if (callback) {
        callback(null);
    }
};

SerialPortMock.prototype.close = function (callback) {
    this._openFlag = false;
    if (callback) {
        callback(null);
    }
    this.emit('close');
};

SerialPortMock.prototype.receive = function (buffer) {
    this.emit('data', buffer);
};

module.exports.SerialPort = SerialPortMock;
