"use strict";
const events = require("events");
const EventEmitter = events.EventEmitter || events;
const net = require("net");
const modbusSerialDebug = require("debug")("modbus-serial");

const crc16 = require("../utils/crc16");

/* TODO: const should be set once, maybe */
const MODBUS_PORT = 502; // modbus port
const MAX_TRANSACTIONS = 256; // maximum transaction to wait for
const MIN_DATA_LENGTH = 6;
const MIN_MBAP_LENGTH = 6;
const CRC_LENGTH = 2;

class TcpPort extends EventEmitter {
    /**
     * Simulate a modbus-RTU port using modbus-TCP connection.
     *
     * @param {string} ip - IP address of Modbus slave.
     * @param {{
     *  port?: number,
     *  localAddress?: string,
     *  family?: 0|4|6,
     *  timeout?: number,
     *  socket?: net.Socket
     *  socketOpts?: {
     *      fd: number,
     *      allowHalfOpen?: boolean,
     *      readable?: boolean,
     *      writable?: boolean,
     *      signal?: AbortSignal
     *  },
     * } & net.TcpSocketConnectOpts} options - Options object.
     *   options.port: Nonstandard Modbus port (default is 502).
     *   options.localAddress: Local IP address to bind to, default is any.
     *   options.family: 4 = IPv4-only, 6 = IPv6-only, 0 = either (default).
     * @constructor
     */
    constructor(ip, options) {
        super();
        const self = this;
        /** @type {boolean} Flag to indicate if port is open */
        this.openFlag = false;
        /** @type {(err?: Error) => void} */
        this.callback = null;
        this._transactionIdWrite = 1;
        /** @type {net.Socket?} - Optional custom socket */
        this._externalSocket = null;

        if(typeof ip === "object") {
            options = ip;
            ip = undefined;
        }

        if (typeof options === "undefined") options = {};

        this.socketOpts = undefined;
        if (options.socketOpts) {
            this.socketOpts = options.socketOpts;
            delete options.socketOpts;
        }

        /** @type {net.TcpSocketConnectOpts} - Options for net.connect(). */
        this.connectOptions =  {
            // Default options
            ...{
                host: ip || options.ip,
                port: MODBUS_PORT
            },
            // User options
            ...options
        };

        if(options.socket) {
            if(options.socket instanceof net.Socket) {
                this._externalSocket = options.socket;
                this.openFlag = this._externalSocket.readyState === "opening" || this._externalSocket.readyState === "open";
            } else {
                throw new Error("invalid socket provided");
            }
        }

        // handle callback - call a callback function only once, for the first event
        // it will trigger
        const handleCallback = function(had_error) {
            if (self.callback) {
                self.callback(had_error);
                self.callback = null;
            }
        };

        // init a socket
        this._client = this._externalSocket || new net.Socket(this.socketOpts);

        if (options.timeout) this._client.setTimeout(options.timeout);

        // register events handlers
        this._client.on("data", function(data) {
            let buffer;
            let crc;
            let length;

            // data recived
            modbusSerialDebug({ action: "receive tcp port strings", data: data });

            // check data length
            while (data.length > MIN_MBAP_LENGTH) {
                // parse tcp header length
                length = data.readUInt16BE(4);

                // cut 6 bytes of mbap and copy pdu
                buffer = Buffer.alloc(length + CRC_LENGTH);
                data.copy(buffer, 0, MIN_MBAP_LENGTH);

                // add crc to message
                crc = crc16(buffer.slice(0, -CRC_LENGTH));
                buffer.writeUInt16LE(crc, buffer.length - CRC_LENGTH);

                // update transaction id and emit data
                self._transactionIdRead = data.readUInt16BE(0);
                self.emit("data", buffer);

                // debug
                modbusSerialDebug({ action: "parsed tcp port", buffer: buffer, transactionId: self._transactionIdRead });

                // reset data
                data = data.slice(length + MIN_MBAP_LENGTH);
            }
        });

        this._client.on("connect", function() {
            self.openFlag = true;
            modbusSerialDebug("TCP port: signal connect");
            handleCallback();
        });

        this._client.on("close", function(had_error) {
            self.openFlag = false;
            modbusSerialDebug("TCP port: signal close: " + had_error);
            handleCallback(had_error);

            self.emit("close");
            self.removeAllListeners();
        });

        this._client.on("error", function(had_error) {
            self.openFlag = false;
            modbusSerialDebug("TCP port: signal error: " + had_error);
            handleCallback(had_error);
        });

        this._client.on("timeout", function() {
            // modbus.openFlag is left in its current state as it reflects two types of timeouts,
            // i.e. 'false' for "TCP connection timeout" and 'true' for "Modbus response timeout"
            // (this allows to continue Modbus request re-tries without reconnecting TCP).
            modbusSerialDebug("TCP port: TimedOut");
            handleCallback(new Error("TCP Connection Timed Out"));
        });
    }

    /**
     * Check if port is open.
     *
     * @returns {boolean}
     */
    get isOpen() {
        return this.openFlag;
    }

    /**
     * Simulate successful port open.
     *
     * @param {(err?: Error) => void} callback
     */
    open(callback) {
        if(this._externalSocket === null) {
            this.callback = callback;
            this._client.connect(this.connectOptions);
        } else if(this.openFlag) {
            modbusSerialDebug("TCP port: external socket is opened");
            callback(); // go ahead to setup existing socket
        } else {
            callback(new Error("TCP port: external socket is not opened"));
        }
    }

    /**
     * Simulate successful close port.
     *
     * @param {(err?: Error) => void} callback
     */
    close(callback) {
        this.callback = callback;
        // DON'T pass callback to `end()` here, it will be handled by client.on('close') handler
        this._client.end();
    }

    /**
     * Simulate successful destroy port.
     *
     * @param {(err?: Error) => void} callback
     */
    destroy(callback) {
        this.callback = callback;
        if (!this._client.destroyed) {
            this._client.destroy();
        }
    }

    /**
     * Send data to a modbus-tcp slave.
     *
     * @param {Buffer} data
     */
    write(data) {
        if(data.length < MIN_DATA_LENGTH) {
            modbusSerialDebug("expected length of data is to small - minimum is " + MIN_DATA_LENGTH);
            return;
        }

        // remember current unit and command
        this._id = data[0];
        this._cmd = data[1];

        // remove crc and add mbap
        const buffer = Buffer.alloc(data.length + MIN_MBAP_LENGTH - CRC_LENGTH);
        buffer.writeUInt16BE(this._transactionIdWrite, 0);
        buffer.writeUInt16BE(0, 2);
        buffer.writeUInt16BE(data.length - CRC_LENGTH, 4);
        data.copy(buffer, MIN_MBAP_LENGTH);

        modbusSerialDebug({
            action: "send tcp port",
            data: data,
            buffer: buffer,
            unitid: this._id,
            functionCode: this._cmd,
            transactionsId: this._transactionIdWrite
        });

        // send buffer to slave
        this._client.write(buffer);

        // set next transaction id
        this._transactionIdWrite = (this._transactionIdWrite + 1) % MAX_TRANSACTIONS;
    }
}

/**
 * TCP port for Modbus.
 *
 * @type {TcpPort}
 */
module.exports = TcpPort;
