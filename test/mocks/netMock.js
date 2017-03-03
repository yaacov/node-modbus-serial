'use strict';
var events = require('events');
var EventEmitter = events.EventEmitter || events;
var util = require('util');

var Server = function(options, connectionListener) {
    EventEmitter.call(this);
};
util.inherits(Server, EventEmitter);
exports.Server = Server;

var Socket = function(options) {
    EventEmitter.call(this);
};
util.inherits(Socket, EventEmitter);

Socket.prototype.connect = function(port, host, connectListener) {
    this.emit('connect');
    if (connectListener) {
        connectListener(null);
    }
};

Socket.prototype.end = function(data, encoding) {
    this.emit('close', false);
};

Socket.prototype.write = function(data, encoding, callback) {
    this._data = data;
};

Socket.prototype.receive = function(buffer) {
    this.emit('data', buffer);
};

exports.Socket = Socket;



exports.createServer = function(options, connectionListener) {
    return new Server(options, connectionListener);
};

