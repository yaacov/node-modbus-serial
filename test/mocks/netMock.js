"use strict";
var events = require("events");
var EventEmitter = events.EventEmitter || events;
var util = require("util");

var Socket = function() {
    EventEmitter.call(this);
    this.destroyed = false;
};
util.inherits(Socket, EventEmitter);

Socket.prototype.connect = function(port, host, connectListener) {
    this.emit("connect");
    if (connectListener) {
        connectListener(null);
    }
};

Socket.prototype.end = function() {
    this.emit("close", false);
};

Socket.prototype.write = function(data) {
    this._data = data;
};

Socket.prototype.receive = function(buffer) {
    this.emit("data", buffer);
};

Socket.prototype.destroy = function() {
    this.emit("close", true);
    this.destroyed = true;
};

exports.Socket = Socket;



var Server = function() {
    EventEmitter.call(this);
};
util.inherits(Server, EventEmitter);

Server.prototype.connect = function(socket) {
    this.emit("connection", socket);
};

Server.prototype.listen = function() {
    this.emit("listening");
};

Server.prototype.end = function() {
    this.emit("close", false);
};

Server.prototype.receive = function(buffer) {
    this.emit("data", buffer);
};

exports.Server = Server;

exports.createServer = function(options, connectionListener) {
    return new Server(options, connectionListener);
};
