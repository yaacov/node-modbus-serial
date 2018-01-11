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
var util = require("util");
var events = require("events");
var EventEmitter = events.EventEmitter || events;
var net = require("net");
var modbusSerialDebug = require("debug")("modbus-serial");

var HOST = "127.0.0.1";
var MODBUS_PORT = 502;

/* Add bit operation functions to Buffer
 */
require("../utils/buffer_bit")();
var crc16 = require("../utils/crc16");

/**
 * Parse a ModbusRTU buffer and return an answer buffer.
 *
 * @param {Buffer} requestBuffer - request Buffer from client
 * @param {object} vector - vector of functions for read and write
 * @returns {Buffer} - on error it is undefined
 * @private
 */
function _parseModbusBuffer(requestBuffer, vector, callback) {
    var unitID = requestBuffer[0];
    var functionCode = requestBuffer[1];
    var crc = requestBuffer[requestBuffer.length - 2] + requestBuffer[requestBuffer.length - 1] * 0x100;

    // if crc is bad, ignore message
    if (crc !== crc16(requestBuffer.slice(0, -2))) {
        modbusSerialDebug("wrong CRC of request Buffer");
        return;
    }

    modbusSerialDebug("request for function code " + functionCode);

    var cb = function(responseBuffer) {
        // add unit-id, function code and crc
        if (responseBuffer) {
            // add unit number and function code
            responseBuffer.writeUInt8(unitID, 0);
            responseBuffer.writeUInt8(functionCode, 1);

            // add crc
            crc = crc16(responseBuffer.slice(0, -2));
            responseBuffer.writeUInt16LE(crc, responseBuffer.length - 2);
        }

        modbusSerialDebug({
            action: "server response",
            unitID: unitID,
            functionCode: functionCode,
            responseBuffer: responseBuffer.toString("hex")
        });

        callback(responseBuffer);
    };

    switch (parseInt(functionCode)) {
        case 1:
        case 2:
            _handleReadCoilsOrInputDiscretes(requestBuffer, vector, unitID, cb);
            break;
        case 3:
            _handleReadMultipleRegisters(requestBuffer, vector, unitID, cb);
            break;
        case 4:
            _handleReadInputRegisters(requestBuffer, vector, unitID, cb);
            break;
        case 5:
            _handleWriteCoil(requestBuffer, vector, unitID, cb);
            break;
        case 6:
            _handleWriteSingleRegister(requestBuffer, vector, unitID, cb);
            break;
        case 15:
            _handleForceMultipleCoils(requestBuffer, vector, unitID, cb);
            break;
        case 16:
            _handleWriteMultipleRegisters(requestBuffer, vector, unitID, cb);
            break;
        default:
            var errorCode = 0x01; // illegal function

            // set an error responce
            functionCode = parseInt(functionCode) | 0x80;
            var responseBuffer = new Buffer(3 + 2);
            responseBuffer.writeUInt8(errorCode, 2);

            modbusSerialDebug({
                error: "Illegal function",
                functionCode: functionCode
            });

            cb(responseBuffer);
    }
}

/**
 * Check the length of request Buffer for length of 8.
 *
 * @param requestBuffer - request Buffer from client
 * @returns {boolean} - if error it is true, otherwise false
 * @private
 */
function _errorRequestBufferLength(requestBuffer) {

    if (requestBuffer.length !== 8) {
        modbusSerialDebug("request Buffer length " + requestBuffer.length + " is wrong - has to be >= 8");
        return true;
    }

    return false; // length is okay - no error
}

/**
 * Function to handle FC1 or FC2 request.
 *
 * @param requestBuffer - request Buffer from client
 * @param vector - vector of functions for read and write
 * @param unitID - Id of the requesting unit
 * @returns {Buffer} - on error it is undefined
 * @private
 */
function _handleReadCoilsOrInputDiscretes(requestBuffer, vector, unitID, callback) {
    var address = requestBuffer.readUInt16BE(2);
    var length = requestBuffer.readUInt16BE(4);

    if (_errorRequestBufferLength(requestBuffer)) {
        return;
    }

    // build answer
    var dataBytes = parseInt((length - 1) / 8 + 1);
    var responseBuffer = new Buffer(3 + dataBytes + 2);
    responseBuffer.writeUInt8(dataBytes, 2);

    // read coils
    if (vector.getCoil) {
        var buildCb = function(i) {
            return function(value) {
                responseBuffer.writeBit(value, i % 8, 3 + parseInt(i / 8));
                callback(responseBuffer);
            };
        };

        for (var i = 0; i < length; i++) {
            if (vector.getCoil.length === 3) {
                vector.getCoil(address + i, unitID, buildCb(i));
            }
            else {
                var value = vector.getCoil(address + i, unitID);
                if (value && value.then) {
                    value.then(buildCb(i));
                }
                else {
                    responseBuffer.writeBit(value, i % 8, 3 + parseInt(i / 8));
                    callback(responseBuffer);
                }
            }
        }
    }
}

/**
 * Function to handle FC3 request.
 *
 * @param requestBuffer - request Buffer from client
 * @param vector - vector of functions for read and write
 * @param unitID - Id of the requesting unit
 * @returns {Buffer} - on error it is undefined
 * @private
 */
function _handleReadMultipleRegisters(requestBuffer, vector, unitID, callback) {
    var address = requestBuffer.readUInt16BE(2);
    var length = requestBuffer.readUInt16BE(4);

    if (_errorRequestBufferLength(requestBuffer)) {
        return;
    }

    // build answer
    var responseBuffer = new Buffer(3 + length * 2 + 2);
    responseBuffer.writeUInt8(length * 2, 2);

    // read registers
    if (vector.getHoldingRegister) {
        var buildCb = function(i) {
            return function(value) {
                responseBuffer.writeUInt16BE(value, 3 + i * 2);

                modbusSerialDebug({ action: "FC3 response", responseBuffer: responseBuffer });

                callback(responseBuffer);
            };
        };

        for (var i = 0; i < length; i++) {
            if (vector.getHoldingRegister.length === 3) {
                vector.getHoldingRegister(address + i, unitID, buildCb(i));
            }
            else {
                var value = vector.getHoldingRegister(address + i, unitID);
                if (value && value.then) {
                    value.then(buildCb(i));
                }
                else {
                    responseBuffer.writeUInt16BE(value, 3 + i * 2);

                    modbusSerialDebug({ action: "FC3 response", responseBuffer: responseBuffer });

                    callback(responseBuffer);
                }
            }
        }
    }
}

/**
 * Function to handle FC4 request.
 *
 * @param requestBuffer - request Buffer from client
 * @param vector - vector of functions for read and write
 * @param unitID - Id of the requesting unit
 * @returns {Buffer} - on error it is undefined
 * @private
 */
function _handleReadInputRegisters(requestBuffer, vector, unitID, callback) {
    var address = requestBuffer.readUInt16BE(2);
    var length = requestBuffer.readUInt16BE(4);

    if (_errorRequestBufferLength(requestBuffer)) {
        return;
    }

    // build answer
    var responseBuffer = new Buffer(3 + length * 2 + 2);
    responseBuffer.writeUInt8(length * 2, 2);

    if (vector.getInputRegister) {
        var buildCb = function(i) {
            return function(value) {
                responseBuffer.writeUInt16BE(value, 3 + i * 2);

                callback(responseBuffer);
            };
        };

        for (var i = 0; i < length; i++) {
            if (vector.getInputRegister.length === 3) {
                vector.getInputRegister(address + i, unitID, buildCb(i));
            }
            else {
                var value = vector.getInputRegister(address + i, unitID);
                if (value && value.then) {
                    value.then(buildCb(i));
                }
                else {
                    responseBuffer.writeUInt16BE(value, 3 + i * 2);

                    callback(responseBuffer);
                }
            }
        }
    }
}

/**
 * Function to handle FC5 request.
 *
 * @param requestBuffer - request Buffer from client
 * @param vector - vector of functions for read and write
 * @param unitID - Id of the requesting unit
 * @returns {Buffer} - on error it is undefined
 * @private
 */
function _handleWriteCoil(requestBuffer, vector, unitID, callback) {
    var address = requestBuffer.readUInt16BE(2);
    var state = requestBuffer.readUInt16BE(4);

    if (_errorRequestBufferLength(requestBuffer)) {
        return;
    }

    // build answer
    var responseBuffer = new Buffer(8);
    responseBuffer.writeUInt16BE(address, 2);
    responseBuffer.writeUInt16BE(state, 4);

    if (vector.setCoil) {
        if (vector.setCoil.length === 4) {
            vector.setCoil(address, state === 0xff00, unitID, function() {
                callback(responseBuffer);
            });
        }
        else {
            var promise = vector.setCoil(address, state === 0xff00, unitID);
            if (promise && promise.then) {
                promise.then(function() {
                    callback(responseBuffer);
                });
            }
            else {
                callback(responseBuffer);
            }
        }
    }
}

/**
 * Function to handle FC6 request.
 *
 * @param requestBuffer - request Buffer from client
 * @param vector - vector of functions for read and write
 * @param unitID - Id of the requesting unit
 * @returns {Buffer} - on error it is undefined
 * @private
 */
function _handleWriteSingleRegister(requestBuffer, vector, unitID, callback) {
    var address = requestBuffer.readUInt16BE(2);
    var value = requestBuffer.readUInt16BE(4);

    if (_errorRequestBufferLength(requestBuffer)) {
        return;
    }

    // build answer
    var responseBuffer = new Buffer(8);
    responseBuffer.writeUInt16BE(address, 2);
    responseBuffer.writeUInt16BE(value, 4);

    if (vector.setRegister) {
        if (vector.setRegister.length === 4) {
            vector.setRegister(address, value, unitID, function() {
                callback(responseBuffer);
            });
        }
        else {
            var promise = vector.setRegister(address, value, unitID);
            if (promise && promise.then) {
                promise.then(function() {
                    callback(responseBuffer);
                });
            }
            else {
                callback(responseBuffer);
            }
        }
    }
}

/**
 * Function to handle FC15 request.
 *
 * @param requestBuffer - request Buffer from client
 * @param vector - vector of functions for read and write
 * @param unitID - Id of the requesting unit
 * @returns {Buffer} - on error it is undefined
 * @private
 */
function _handleForceMultipleCoils(requestBuffer, vector, unitID, callback) {
    var address = requestBuffer.readUInt16BE(2);
    var length = requestBuffer.readUInt16BE(4);

    // if length is bad, ignore message
    if (requestBuffer.length !== 7 + Math.ceil(length / 8) + 2) {
        return;
    }

    // build answer
    var responseBuffer = new Buffer(8);
    responseBuffer.writeUInt16BE(address, 2);
    responseBuffer.writeUInt16BE(length, 4);

    if (vector.setCoil) {
        var state;
        for (var i = 0; i < length; i++) {
            state = requestBuffer.readBit(i, 7);

            if (vector.setCoil.length === 4) {
                vector.setCoil(address + i, state !== 0, unitID, function() {
                    callback(responseBuffer);
                });
            }
            else {
                var promise = vector.setCoil(address + i, state !== 0, unitID);
                if (promise && promise.then) {
                    promise.then(function() {
                        callback(responseBuffer);
                    });
                }
                else {
                    callback(responseBuffer);
                }
            }
        }
    }
}

/**
 * Function to handle FC16 request.
 *
 * @param requestBuffer - request Buffer from client
 * @param vector - vector of functions for read and write
 * @param unitID - Id of the requesting unit
 * @returns {Buffer} - on error it is undefined
 * @private
 */
function _handleWriteMultipleRegisters(requestBuffer, vector, unitID, callback) {
    var address = requestBuffer.readUInt16BE(2);
    var length = requestBuffer.readUInt16BE(4);

    // if length is bad, ignore message
    if (requestBuffer.length !== (7 + length * 2 + 2)) {
        return;
    }

    // build answer
    var responseBuffer = new Buffer(8);
    responseBuffer.writeUInt16BE(address, 2);
    responseBuffer.writeUInt16BE(length, 4);

    // write registers
    if (vector.setRegister) {
        var value;

        for (var i = 0; i < length; i++) {
            value = requestBuffer.readUInt16BE(7 + i * 2);

            if (vector.setRegister.length === 4) {
                vector.setRegister(address + i, value, unitID, function() {
                    callback(responseBuffer);
                });
            }
            else {
                var promise = vector.setRegister(address + i, value, unitID);
                if (promise && promise.then) {
                    promise.then(function() {
                        callback(responseBuffer);
                    });
                }
                else {
                    callback(responseBuffer);
                }
            }
        }
    }
}

/**
 * Class making ModbusTCP server.
 *
 * @param vector - vector of server functions (see examples/server.js)
 * @param options - server options (host (IP), port, debug (true/false), unitID)
 * @constructor
 */
var ServerTCP = function(vector, options) {
    var modbus = this;
    options = options || {};

    // create a tcp server
    modbus._server = net.createServer();
    modbus._server.listen(options.port || MODBUS_PORT, options.host || HOST);

    modbus._server.on("connection", function(sock) {
        modbusSerialDebug({
            action: "connected",
            address: sock.address(),
            remoteAddress: sock.remoteAddress,
            remotePort: sock.remotePort
        });

        sock.on("data", function(data) {
            modbusSerialDebug({ action: "socket data", data: data });

            // remove mbap and add crc16
            var requestBuffer = new Buffer(data.length - 6 + 2);
            data.copy(requestBuffer, 0, 6);
            var crc = crc16(requestBuffer.slice(0, -2));
            requestBuffer.writeUInt16LE(crc, requestBuffer.length - 2);

            modbusSerialDebug({ action: "receive", data: requestBuffer, requestBufferLength: requestBuffer.length });
            modbusSerialDebug(JSON.stringify({ action: "receive", data: requestBuffer }));

            // if length is too short, ignore message
            if (requestBuffer.length < 8) {
                return;
            }

            var cb = function(responseBuffer) {
                // send data back
                if (responseBuffer) {
                    // get transaction id
                    var transactionsId = data.readUInt16BE(0);

                    // remove crc and add mbap
                    var outTcp = new Buffer(responseBuffer.length + 6 - 2);
                    outTcp.writeUInt16BE(transactionsId, 0);
                    outTcp.writeUInt16BE(0, 2);
                    outTcp.writeUInt16BE(responseBuffer.length - 2, 4);
                    responseBuffer.copy(outTcp, 6);

                    modbusSerialDebug({ action: "send", data: responseBuffer });
                    modbusSerialDebug(JSON.stringify({ action: "send string", data: responseBuffer }));

                    // write to port
                    sock.write(outTcp);
                }
            };

            // parse the modbusRTU buffer
            _parseModbusBuffer(requestBuffer, vector, cb);
        });
    });
    EventEmitter.call(this);
};
util.inherits(ServerTCP, EventEmitter);

/**
 * ServerTCP interface export.
 * @type {ServerTCP}
 */
module.exports = ServerTCP;
