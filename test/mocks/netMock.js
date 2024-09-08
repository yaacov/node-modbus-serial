"use strict";
const events = require("events");
const EventEmitter = events.EventEmitter || events;

class Socket extends EventEmitter {
    constructor() {
        super();
        this.destroyed = false;
    }

    connect(port, host, connectListener) {
        this.emit("connect");
        if (connectListener) {
            connectListener(null);
        }
    }

    setNoDelay() {
        return this;
    }

    end() {
        this.emit("close", false);
    }

    write(data) {
        this._data = data;
        return true;
    }

    receive(buffer) {
        this.emit("data", buffer);
    }

    destroy() {
        this.emit("close", true);
        this.destroyed = true;
    }
}

exports.Socket = Socket;

class Server extends EventEmitter {
    connect(socket) {
        this.emit("connection", socket);
    }

    listen() {
        this.emit("listening");
    }

    end() {
        this.emit("close", false);
    }

    receive(buffer) {
        this.emit("data", buffer);
    }
}

exports.Server = Server;

exports.createServer = function(options, connectionListener) {
    return new Server(options, connectionListener);
};
