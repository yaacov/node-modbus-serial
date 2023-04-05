"use strict";
/**
 * Copyright (c) 2017, Yaacov Zamir <kobi.zamir@gmail.com>
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
const events = require("events");
const EventEmitter = events.EventEmitter || events;
const modbusSerialDebug = require("debug")("modbus-serial");
const { SerialPort } = require("serialport");
const ServerSerialPipeHandler = require("./serverserial_pipe_handler");

const PORT = "/dev/tty";
const BAUDRATE = 9600;

const UNIT_ID = 255; // listen to all adresses

const ADDR_LEN = 1;

/* Get Handlers
 */
const handlers = require("./servertcp_handler");

/* Add bit operation functions to Buffer
 */
require("../utils/buffer_bit")();
const crc16 = require("../utils/crc16");

/**
 * Helper function for sending debug objects.
 *
 * @param {string} text - text of message, an error or an action
 * @param {int} unitID - Id of the requesting unit
 * @param {int} functionCode - a modbus function code.
 * @param {Buffer} requestBuffer - request Buffer from client
 * @returns undefined
 * @private
 */
function _serverDebug(text, unitID, functionCode, responseBuffer) {
    // If no responseBuffer, then assume this is an error
    // o/w assume an action
    if (typeof responseBuffer === "undefined") {
        modbusSerialDebug({
            error: text,
            unitID: unitID,
            functionCode: functionCode
        });

    } else {
        modbusSerialDebug({
            action: text,
            unitID: unitID,
            functionCode: functionCode,
            responseBuffer: responseBuffer.toString("hex")
        });
    }
}

/**
 * Helper function for creating callback functions.
 *
 * @param {int} unitID - Id of the requesting unit
 * @param {int} functionCode - a modbus function code
 * @param {function} sockWriter - write buffer (or error) to tcp socket
 * @returns {function} - a callback function
 * @private
 */
function _callbackFactory(unitID, functionCode, sockWriter) {
    return function cb(err, responseBuffer) {
        // If we have an error.
        if (err) {
            let errorCode = 0x04; // slave device failure
            if (!isNaN(err.modbusErrorCode)) {
                errorCode = err.modbusErrorCode;
            }

            // Set an error response
            functionCode = parseInt(functionCode) | 0x80;
            responseBuffer = Buffer.alloc(3 + 2);
            responseBuffer.writeUInt8(errorCode, 2);

            _serverDebug("error processing response", unitID, functionCode);
        }

        // If we do not have a responseBuffer
        if (!responseBuffer) {
            _serverDebug("no response buffer", unitID, functionCode);
            return sockWriter(null, responseBuffer);
        }

        // add unit number and function code
        responseBuffer.writeUInt8(unitID, 0);
        responseBuffer.writeUInt8(functionCode, 1);

        // Add crc
        const crc = crc16(responseBuffer.slice(0, -2));
        responseBuffer.writeUInt16LE(crc, responseBuffer.length - 2);

        // Call callback function
        _serverDebug("server response", unitID, functionCode, responseBuffer);
        return sockWriter(null, responseBuffer);
    };
}

/**
 * Parse a ModbusRTU buffer and return an answer buffer.
 *
 * @param {Buffer} requestBuffer - request Buffer from client
 * @param {object} vector - vector of functions for read and write
 * @param {function} callback - callback to be invoked passing {Buffer} response
 * @param {object} options - the options object
 * @returns undefined
 * @private
 */
function _parseModbusBuffer(requestBuffer, vector, serverUnitID, sockWriter, options) {
    // Check requestBuffer length
    if (!requestBuffer || requestBuffer.length < ADDR_LEN) {
        modbusSerialDebug("wrong size of request Buffer " + requestBuffer.length);
        return;
    }

    const unitID = requestBuffer[0];
    let functionCode = requestBuffer[1];
    const crc = requestBuffer[requestBuffer.length - 2] + requestBuffer[requestBuffer.length - 1] * 0x100;

    // if crc is bad, ignore message
    if (crc !== crc16(requestBuffer.slice(0, -2))) {
        modbusSerialDebug("wrong CRC of request Buffer");
        return;
    }

    // if crc is bad, ignore message
    if (serverUnitID !== 255 && serverUnitID !== unitID) {
        modbusSerialDebug("wrong unitID");
        return;
    }

    modbusSerialDebug("request for function code " + functionCode);
    const cb = _callbackFactory(unitID, functionCode, sockWriter);

    switch (parseInt(functionCode)) {
        case 1:
        case 2:
            handlers.readCoilsOrInputDiscretes(requestBuffer, vector, unitID, cb, functionCode);
            break;
        case 3:
            if (options && options.enron) {
                handlers.readMultipleRegistersEnron(requestBuffer, vector, unitID, options.enronTables, cb);
            } else {
                handlers.readMultipleRegisters(requestBuffer, vector, unitID, cb);
            }
            break;
        case 4:
            handlers.readInputRegisters(requestBuffer, vector, unitID, cb);
            break;
        case 5:
            handlers.writeCoil(requestBuffer, vector, unitID, cb);
            break;
        case 6:
            if (options && options.enron) {
                handlers.writeSingleRegisterEnron(requestBuffer, vector, unitID, options.enronTables, cb);
            } else {
                handlers.writeSingleRegister(requestBuffer, vector, unitID, cb);
            }
            break;
        case 15:
            handlers.forceMultipleCoils(requestBuffer, vector, unitID, cb);
            break;
        case 16:
            handlers.writeMultipleRegisters(requestBuffer, vector, unitID, cb);
            break;
        case 17:
            handlers.reportServerID(requestBuffer, vector, unitID, cb);
            break;
        case 43:
            handlers.handleMEI(requestBuffer, vector, unitID, cb);
            break;
        default: {
            const errorCode = 0x01; // illegal function

            // set an error response
            functionCode = parseInt(functionCode) | 0x80;
            const responseBuffer = Buffer.alloc(3 + 2);
            responseBuffer.writeUInt8(errorCode, 2);

            modbusSerialDebug({
                error: "Illegal function",
                functionCode: functionCode
            });

            cb({ modbusErrorCode: errorCode }, responseBuffer);
        }
    }
}

class ServerSerial extends EventEmitter {
    /**
     * Class making ModbusRTU server.
     *
     * @param vector - vector of server functions (see examples/server.js)
     * @param options - server options (host (IP), port, debug (true/false), unitID, enron? (true/false), enronTables? (object))
     * @param serialportOptions - additional parameters for serialport options
     * @constructor
     */
    constructor(vector, options, serialportOptions) {
        super();

        const modbus = this;
        options = options || {};

        const optionsWithBinding = {
            path: options.path || options.port || PORT,
            baudRate: options.baudRate || options.baudrate || BAUDRATE,
            debug: options.debug || false,
            unitID: options.unitID || 255
        };

        const optionsWithSerialPortTimeoutParser = {
            maxBufferSize: options.maxBufferSize || 65536,
            interval: options.interval || 30
        };

        if (options.binding) optionsWithBinding.binding = options.binding;

        // Assign extra parameters in serialport
        const optionsWithBindingandSerialport = Object.assign({}, serialportOptions, optionsWithBinding);

        // create a serial server
        modbus._serverPath = new SerialPort(optionsWithBindingandSerialport);

        // create a serial server with a timeout parser
        modbus._server = modbus._serverPath.pipe(new ServerSerialPipeHandler(optionsWithSerialPortTimeoutParser));

        // Open errors will be emitted as an error event
        modbus._server.on("error", function(err) {
            console.log("Error: ", err.message);
        });

        // create a server unit id
        const serverUnitID = options.unitID || UNIT_ID;

        // remember open sockets
        modbus.socks = new Map();

        modbus._server.on("open", function() {
            modbus.socks.set(modbus._server, 0);

            modbusSerialDebug({
                action: "connected"
                // address: sock.address(),
                // remoteAddress: sock.remoteAddress,
                // localPort: sock.localPort
            });

            modbus._server.on("close", function() {
                modbusSerialDebug({
                    action: "closed"
                });
                modbus.socks.delete(modbus._server);
            });

        });

        modbus._server.on("data", function(data) {
            let recvBuffer = Buffer.from([]);

            modbusSerialDebug({ action: "socket data", data: data });
            recvBuffer = Buffer.concat([recvBuffer, data], recvBuffer.length + data.length);

            while (recvBuffer.length > ADDR_LEN) {
                const requestBuffer = Buffer.alloc(recvBuffer.length);
                recvBuffer.copy(requestBuffer, 0, 0, recvBuffer.length);

                // Move receive buffer on
                recvBuffer = recvBuffer.slice(recvBuffer.length);

                const crc = crc16(requestBuffer.slice(0, -2));
                requestBuffer.writeUInt16LE(crc, requestBuffer.length - 2);

                modbusSerialDebug({ action: "receive", data: requestBuffer, requestBufferLength: requestBuffer.length });
                modbusSerialDebug(JSON.stringify({ action: "receive", data: requestBuffer }));

                const sockWriter = function(err, responseBuffer) {
                    if (err) {
                        console.error(err, responseBuffer);
                        modbus.emit("error", err);
                        return;
                    }

                    // send data back
                    if (responseBuffer) {
                        modbusSerialDebug({ action: "send", data: responseBuffer });
                        modbusSerialDebug(JSON.stringify({ action: "send string", data: responseBuffer }));

                        // write to port
                        (options.portResponse || modbus._serverPath).write(responseBuffer);
                    }
                };

                // parse the modbusRTU buffer
                setTimeout(
                    _parseModbusBuffer.bind(this,
                        requestBuffer,
                        vector,
                        serverUnitID,
                        sockWriter,
                        options
                    ),
                    0
                );
            }
        });

        modbus._server.on("error", function(err) {
            modbusSerialDebug(JSON.stringify({ action: "socket error", data: err }));

            modbus.emit("socketError", err);
        });

    }

    getPort() {
        return this._serverPath;
    }

    /**
    * Delegate the close server method to backend.
    *
    * @param callback
    */
    close(callback) {
        const modbus = this;

        // close the net port if exist
        if (modbus._server) {
            modbus._server.removeAllListeners("data");
            modbus._serverPath.close(callback);

            modbus.socks.forEach(function(e, sock) {
                sock.destroy();
            });

            modbusSerialDebug({ action: "close server" });
        } else {
            modbusSerialDebug({ action: "close server", warning: "server already closed" });
        }
    }
}

/**
 * ServerSerial interface export.
 * @type {ServerSerial}
 */
module.exports = ServerSerial;
