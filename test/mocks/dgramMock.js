"use strict";
var events = require("events");
var EventEmitter = events.EventEmitter || events;
var util = require("util");

var Socket = function() {
    EventEmitter.call(this);
};

Socket.prototype.connect = function(port, host, connectListener) {
    this.emit("connect");
    if (connectListener) {
        connectListener(null);
    }
};
util.inherits(Socket, EventEmitter);

Socket.prototype.close = function(callback) {
    this.emit("close", false);
    if (callback) {
        callback();
    }
};

Socket.prototype.send = function(buffer, offset, length, port, address, callback) {
    this._data = buffer;
    this._offset = offset;
    this._length = length;
    this._port = port;
    this._address = address;
    if (callback) {
        callback(null);
    }
};

Socket.prototype.bind = function() {
    this.emit("listening");
};

// Obsolete? It doesn't reflect the dgram interface
Socket.prototype.listen = function() {
    this.emit("listening");
};

Socket.prototype.receive = function(buffer) {
    this.emit("message", buffer, { address: this._address, port: this._port, size: this._data.length });
};

exports.Socket = Socket;


exports.createSocket = function(type, listener) {
    return new Socket(type, listener);
};
