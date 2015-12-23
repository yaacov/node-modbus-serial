'use strict';
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

/**
 * Adds connection shorthand API to a Modbus objext
 *
 * @param {ModbusRTU} Modbus the ModbusRTU object.
 */
var addConnctionAPI = function(Modbus) {
    
    var cl = Modbus.prototype;
    
    /** 
     * Connect to a communication port, using SerialPort.
     *
     * @param {string} path the path to the Serial Port - required.
     * @param {object} options - the serial port options - optional.
     * @param {function} next the function to call next.
     */
    cl.connectRTU = function (path, options, next) {
        // check if we have options
        if (typeof(next) == 'undefined' && typeof(options) == 'function') {
            next = options;
            options = {};
        }
        
        // create the SerialPort
        var SerialPort = require("serialport").SerialPort;
        var serialPort = new SerialPort(path, options);
        
        // re-set the serial port to use
        this._port = serialPort;
        
        // open and call next
        this.open(next);
    }

    /** 
     * Connect to a communication port, using TcpPort.
     *
     * @param {string} ip the ip of the TCP Port - required.
     * @param {object} options - the serial port options - optional.
     * @param {function} next the function to call next.
     */
    cl.connectTCP = function (ip, options, next) {
        var port;
        
        // check if we have options
        if (typeof(next) == 'undefined' && typeof(options) == 'function') {
            next = options;
            options = {};
        }
        
        // create the TcpPort
        var TcpPort = require('../ports/tcpport');
        var tcpPort = new TcpPort(ip, options);
        
        // re-set the port to use
        this._port = tcpPort;
        
        // open and call next
        this.open(next);
    }
    
    /** 
     * Connect to a communication port, using TelnetPort.
     *
     * @param {string} ip the ip of the TelnetPort - required.
     * @param {object} options - the serial port options - optional.
     * @param {function} next the function to call next.
     */
    cl.connectTelnet = function (ip, options, next) {
        var port;
        
        // check if we have options
        if (typeof(next) == 'undefined' && typeof(options) == 'function') {
            next = options;
            options = {};
        }
        
        // create the TcpPort
        var TelnetPort = require('../ports/telnetport');
        var telnetPort = new TelnetPort(ip, options);
        
        // re-set the port to use
        this._port = telnetPort;
        
        // open and call next
        this.open(next);
    }
    
    /** 
     * Connect to a communication port, using C701 UDP-to-Serial bridge.
     *
     * @param {string} ip the ip of the TelnetPort - required.
     * @param {object} options - the serial port options - optional.
     * @param {function} next the function to call next.
     */
    cl.connectC701 = function (ip, options, next) {
        var port;
        
        // check if we have options
        if (typeof(next) == 'undefined' && typeof(options) == 'function') {
            next = options;
            options = {};
        }
        
        // create the TcpPort
        var C701Port = require('../ports/c701port');
        var c701Port = new C701Port(ip, options);
        
        // re-set the port to use
        this._port = c701Port;
        
        // open and call next
        this.open(next);
    }
    
    /** 
     * Connect to a communication port, using Bufferd Serial port.
     *
     * @param {string} path the path to the Serial Port - required.
     * @param {object} options - the serial port options - optional.
     * @param {function} next the function to call next.
     */
    cl.connectRTUBuffered = function (path, options, next) {
        // check if we have options
        if (typeof(next) == 'undefined' && typeof(options) == 'function') {
            next = options;
            options = {};
        }
        
        // create the SerialPort
        var SerialPort = require('../ports/rtubufferedport');
        var serialPort = new SerialPort(path, options);
        
        // re-set the serial port to use
        this._port = serialPort;
        
        // open and call next
        this.open(next);
    }
}

module.exports = addConnctionAPI;
