"use strict";
/**
 * Copyright (c) 2015, Yaacov Zamir <kobi.zamir@gmail.com>
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF  THIS SOFTWARE.
 */

var MIN_MODBUSRTU_FRAMESZ = 5;

/**
 * Adds connection shorthand API to a Modbus objext
 *
 * @param {ModbusRTU} Modbus the ModbusRTU object.
 */
var addConnctionAPI = function(Modbus) {
    var cl = Modbus.prototype;

    var open = function(obj, next) {
        /* the function check for a callback
         * if we have a callback, use it
         * o/w build a promise.
         */
        if (next) {
            // if we have a callback, use the callback
            obj.open(next);
        } else {
            // o/w use  a promise
            var promise = new Promise(function(resolve, reject) {
                function cb(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }

                obj.open(cb);
            });

            return promise;
        }
    };

    /**
     * Connect to a communication port, using SerialPort.
     *
     * @param {string} path the path to the Serial Port - required.
     * @param {Object} options - the serial port options - optional.
     * @param {Function} next the function to call next.
     */
    cl.connectRTU = function(path, options, next) {
        // check if we have options
        if (typeof next === "undefined" && typeof options === "function") {
            next = options;
            options = {};
        }

        // check if we have options
        if (typeof options === "undefined") {
            options = {};
        }

        // disable auto open, as we handle the open
        options.autoOpen = false;
        // set vmin to smallest modbus packet size
        options.platformOptions = { vmin: MIN_MODBUSRTU_FRAMESZ, vtime: 0 };

        // create the SerialPort
        var SerialPort = require("serialport");
        this._port = new SerialPort(path, options);

        // open and call next
        return open(this, next);
    };

    /**
     * Connect to a communication port, using TcpPort.
     *
     * @param {string} ip the ip of the TCP Port - required.
     * @param {Object} options - the serial port options - optional.
     * @param {Function} next the function to call next.
     */
    cl.connectTCP = function(ip, options, next) {
        // check if we have options
        if (typeof next === "undefined" && typeof options === "function") {
            next = options;
            options = {};
        }

        // check if we have options
        if (typeof options === "undefined") {
            options = {};
        }

        // create the TcpPort
        var TcpPort = require("../ports/tcpport");
        if (this._timeout) {
            options.timeout = this._timeout;
        }
        this._port = new TcpPort(ip, options);

        // open and call next
        return open(this, next);
    };

    /**
     * Connect to a communication port, using TcpRTUBufferedPort.
     *
     * @param {string} ip the ip of the TCP Port - required.
     * @param {Object} options - the serial tcp port options - optional.
     * @param {Function} next the function to call next.
     */
    cl.connectTcpRTUBuffered = function(ip, options, next) {
        // check if we have options
        if (typeof next === "undefined" && typeof options === "function") {
            next = options;
            options = {};
        }

        // check if we have options
        if (typeof options === "undefined") {
            options = {};
        }

        var TcpRTUBufferedPort = require("../ports/tcprtubufferedport");
        if (this._timeout) {
            options.timeout = this._timeout;
        }
        this._port = new TcpRTUBufferedPort(ip, options);

        // open and call next
        return open(this, next);
    };

    /**
     * Connect to a communication port, using TelnetPort.
     *
     * @param {string} ip the ip of the TelnetPort - required.
     * @param {Object} options - the serial port options - optional.
     * @param {Function} next the function to call next.
     */
    cl.connectTelnet = function(ip, options, next) {
        // check if we have options
        if (typeof next === "undefined" && typeof options === "function") {
            next = options;
            options = {};
        }

        // check if we have options
        if (typeof options === "undefined") {
            options = {};
        }

        // create the TcpPort
        var TelnetPort = require("../ports/telnetport");
        if (this._timeout) {
            options.timeout = this._timeout;
        }
        this._port = new TelnetPort(ip, options);

        // open and call next
        return open(this, next);
    };

    /**
     * Connect to a communication port, using C701 UDP-to-Serial bridge.
     *
     * @param {string} ip the ip of the TelnetPort - required.
     * @param {Object} options - the serial port options - optional.
     * @param {Function} next the function to call next.
     */
    cl.connectC701 = function(ip, options, next) {
        // check if we have options
        if (typeof next === "undefined" && typeof options === "function") {
            next = options;
            options = {};
        }

        // check if we have options
        if (typeof options === "undefined") {
            options = {};
        }

        // create the TcpPort
        var C701Port = require("../ports/c701port");
        this._port = new C701Port(ip, options);

        // open and call next
        return open(this, next);
    };

    /**
     * Connect to a communication port, using modbus-udp.
     *
     * @param {string} ip the ip of the UDP Port - required.
     * @param {Object} options - the serial port options - optional.
     * @param {Function} next the function to call next.
     */
    cl.connectUDP = function(ip, options, next) {
        // check if we have options
        if (typeof next === "undefined" && typeof options === "function") {
            next = options;
            options = {};
        }

        // check if we have options
        if (typeof options === "undefined") {
            options = {};
        }

        // create the UdpPort
        var UdpPort = require("../ports/udpport");
        this._port = new UdpPort(ip, options);

        // open and call next
        return open(this, next);
    };

    /**
     * Connect to a communication port, using Bufferd Serial port.
     *
     * @param {string} path the path to the Serial Port - required.
     * @param {Object} options - the serial port options - optional.
     * @param {Function} next the function to call next.
     */
    cl.connectRTUBuffered = function(path, options, next) {
        // check if we have options
        if (typeof next === "undefined" && typeof options === "function") {
            next = options;
            options = {};
        }

        // check if we have options
        if (typeof options === "undefined") {
            options = {};
        }

        // create the SerialPort
        var SerialPort = require("../ports/rtubufferedport");
        this._port = new SerialPort(path, options);

        // set vmin to smallest modbus packet size
        options.platformOptions = { vmin: MIN_MODBUSRTU_FRAMESZ, vtime: 0 };

        // open and call next
        return open(this, next);
    };

    /**
     * Connect to a communication port, using ASCII Serial port.
     *
     * @param {string} path the path to the Serial Port - required.
     * @param {Object} options - the serial port options - optional.
     * @param {Function} next the function to call next.
     */
    cl.connectAsciiSerial = function(path, options, next) {
        // check if we have options
        if (typeof next === "undefined" && typeof options === "function") {
            next = options;
            options = {};
        }

        // check if we have options
        if (typeof options === "undefined") {
            options = {};
        }

        // create the ASCII SerialPort
        var SerialPortAscii = require("../ports/asciiport");
        this._port = new SerialPortAscii(path, options);

        // open and call next
        return open(this, next);
    };
};

/**
 * Connection API Modbus.
 *
 * @type {addConnctionAPI}
 */
module.exports = addConnctionAPI;
