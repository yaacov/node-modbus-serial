'use strict';
var util = require('util');
var events = require('events');


/**
 * Simulate a modbus-RTU port
 */
var DummyPort = function() {
    this.openFlag = false;
    events.call(this);
};
util.inherits(DummyPort, events);

DummyPort.prototype.open = function (callback) {
    this.openFlag = true;
    if (callback) {
        callback(null);
    }
};

DummyPort.prototype.close = function(callback) {
    this.openFlag = false;
    if (callback) {
        callback(null);
    }
};

DummyPort.prototype.isOpen = function() {
    return this.openFlag;
};

DummyPort.prototype.write = function(data) {
    this.data = data;
};

// needed for simulating a net.Socket
DummyPort.prototype.end = function(data, encoding) {};

DummyPort.prototype.receive = function(data) {
    this.emit('data', data);
};

module.exports = DummyPort;
