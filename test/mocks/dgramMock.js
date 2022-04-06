"use strict";
const events = require("events");
const EventEmitter = events.EventEmitter || events;

class Socket extends EventEmitter {
    connect(port, host, connectListener) {
        this.emit("connect");
        if (connectListener) {
            connectListener(null);
        }
    }

    close(callback) {
        this.emit("close", false);
        if (callback) {
            callback();
        }
    }

    send(buffer, offset, length, port, address, callback) {
        this._data = buffer;
        this._offset = offset;
        this._length = length;
        this._port = port;
        this._address = address;
        if (callback) {
            callback(null);
        }
    }

    bind() {
        this.emit("listening");
    }

    // Obsolete? It doesn't reflect the dgram interface
    listen() {
        this.emit("listening");
    }

    receive(buffer) {
        this.emit("message", buffer, { address: this._address, port: this._port, size: this._data.length });
    }
}

exports.Socket = Socket;

exports.createSocket = function(type, listener) {
    return new Socket(type, listener);
};
