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
 // Not really its official length, but we parse UnitID as part of PDU
const MBAP_LEN = 6;

/* Add bit operation functions to Buffer
 */
require("../utils/buffer_bit")();
var crc16 = require("../utils/crc16");

/**
 * Parse a ModbusRTU buffer and return an answer buffer.
 *
 * @param {Buffer} requestBuffer - request Buffer from client
 * @param {object} vector - vector of functions for read and write
 * @param {function} callback - callback to be invoked passing {Buffer} response
 * @returns undefined
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

    var cb = function(err, responseBuffer) {
        if (err) {
            modbusSerialDebug({
                error: "error processing response",
                unitID: unitID,
                functionCode: functionCode
            });

            var errorCode = 0x04; // slave device failure
            if (!isNaN(err.modbusErrorCode))
                errorCode = err.modbusErrorCode;

            // set an error response
            functionCode = parseInt(functionCode) | 0x80;
            responseBuffer = Buffer.alloc(3 + 2);
            responseBuffer.writeUInt8(errorCode, 2);

            cb(null, responseBuffer);
            return;
        }

        // add unit-id, function code and crc
        if (responseBuffer) {
            // add unit number and function code
            responseBuffer.writeUInt8(unitID, 0);
            responseBuffer.writeUInt8(functionCode, 1);

            // add crc
            crc = crc16(responseBuffer.slice(0, -2));
            responseBuffer.writeUInt16LE(crc, responseBuffer.length - 2);

            modbusSerialDebug({
                action: "server response",
                unitID: unitID,
                functionCode: functionCode,
                responseBuffer: responseBuffer.toString("hex")
            });
        }
        else {
            modbusSerialDebug({
                error: "no response buffer",
                unitID: unitID,
                functionCode: functionCode
            });
        }

        modbusSerialDebug({
            action: "server response",
            unitID: unitID,
            functionCode: functionCode,
            responseBuffer: responseBuffer.toString("hex")
        });

        callback(null, responseBuffer);
    };

    switch (parseInt(functionCode)) {
        case 1:
        case 2:
            _handleReadCoilsOrInputDiscretes(requestBuffer, vector, unitID, cb, functionCode);
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

            // set an error response
            functionCode = parseInt(functionCode) | 0x80;
            var responseBuffer = Buffer.alloc(3 + 2);
            responseBuffer.writeUInt8(errorCode, 2);

            modbusSerialDebug({
                error: "Illegal function",
                functionCode: functionCode
            });

            cb(null, responseBuffer);
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
 * Handle the callback invocation for Promises or synchronous values
 *
 * @param promiseOrValue - the Promise to be resolved or value to be returned
 * @param cb - the callback to be invoked
 * @returns undefined
 * @private
 */
function _handlePromiseOrValue(promiseOrValue, cb) {
    if (promiseOrValue && promiseOrValue.then && typeof promiseOrValue.then === "function") {
        promiseOrValue.then(function(value) {
            cb(null, value);
        });
        if (promiseOrValue.catch && typeof promiseOrValue.catch === "function") {
            promiseOrValue.catch(function(err) {
                cb(err);
            });
        }
    }
    else {
        cb(null, promiseOrValue);
    }
}


/**
 * Function to handle FC1 or FC2 request.
 *
 * @param requestBuffer - request Buffer from client
 * @param vector - vector of functions for read and write
 * @param unitID - Id of the requesting unit
 * @param {function} callback - callback to be invoked passing {Buffer} response
 * @returns undefined
 * @private
 */
function _handleReadCoilsOrInputDiscretes(requestBuffer, vector, unitID, callback, fc) {
    var address = requestBuffer.readUInt16BE(2);
    var length = requestBuffer.readUInt16BE(4);

    if (_errorRequestBufferLength(requestBuffer)) {
        return;
    }

    // build answer
    var dataBytes = parseInt((length - 1) / 8 + 1);
    var responseBuffer = Buffer.alloc(3 + dataBytes + 2);
    responseBuffer.writeUInt8(dataBytes, 2);

    var vectorCB;
    if(fc === 1)
        vectorCB = vector.getCoil;
    else if (fc === 2)
        vectorCB = vector.getDiscreteInput;

    // read coils
    if (vectorCB) {
        var callbackInvoked = false;
        var cbCount = 0;
        var buildCb = function(i) {
            return function(err, value) {
                if (err) {
                    if (!callbackInvoked) {
                        callbackInvoked = true;
                        callback(err);
                    }

                    return;
                }

                cbCount = cbCount + 1;

                responseBuffer.writeBit(value, i % 8, 3 + parseInt(i / 8));

                if (cbCount === length && !callbackInvoked) {
                    modbusSerialDebug({ action: "FC" + fc + " response", responseBuffer: responseBuffer });

                    callbackInvoked = true;
                    callback(null, responseBuffer);
                }
            };
        };

        if (length === 0)
            callback({
                modbusErrorCode: 0x02, // Illegal address
                msg: "Invalid length"
            });

        for (var i = 0; i < length; i++) {
            var cb = buildCb(i);
            try {
                if (vectorCB.length === 3) {
                    vectorCB(address + i, unitID, cb);
                }
                else {
                    var promiseOrValue = vectorCB(address + i, unitID);
                    _handlePromiseOrValue(promiseOrValue, cb);
                }
            }
            catch(err) {
                cb(err);
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
 * @param {function} callback - callback to be invoked passing {Buffer} response
 * @returns undefined
 * @private
 */
function _handleReadMultipleRegisters(requestBuffer, vector, unitID, callback) {
    var address = requestBuffer.readUInt16BE(2);
    var length = requestBuffer.readUInt16BE(4);

    if (_errorRequestBufferLength(requestBuffer)) {
        return;
    }

    // build answer
    var responseBuffer = Buffer.alloc(3 + length * 2 + 2);
    responseBuffer.writeUInt8(length * 2, 2);

    var callbackInvoked = false;
    var cbCount = 0;
    var buildCb = function(i) {
        return function(err, value) {
            if (err) {
                if (!callbackInvoked) {
                    callbackInvoked = true;
                    callback(err);
                }

                return;
            }

            cbCount = cbCount + 1;

            responseBuffer.writeUInt16BE(value, 3 + i * 2);

            if (cbCount === length && !callbackInvoked) {
                modbusSerialDebug({ action: "FC3 response", responseBuffer: responseBuffer });

                callbackInvoked = true;
                callback(null, responseBuffer);
            }
        };
    };

    if (length === 0)
        callback({
            modbusErrorCode: 0x02, // Illegal address
            msg: "Invalid length"
        });

    // read registers
    function tryAndHandlePromiseOrValue(i, values) {
        var cb = buildCb(i);
        try {
            var promiseOrValue = values[i];
            _handlePromiseOrValue(promiseOrValue, cb);
        }
        catch (err) {
            cb(err);
        }
    }

    if (vector.getMultipleHoldingRegisters && length > 1) {

        if (vector.getMultipleHoldingRegisters.length === 4) {
            vector.getMultipleHoldingRegisters(address, length, unitID, function(err, values) {
                if (!err && values.length !== length) {
                    var error = new Error("Requested address length and response length do not match");
                    callback(error);
                    throw error;
                } else {
                    for (var i = 0; i < length; i++) {
                        var cb = buildCb(i);
                        try {
                            cb(err, values[i]);
                        }
                        catch (ex) {
                            cb(ex);
                        }
                    }
                }
            });
        } else {
            var values = vector.getMultipleHoldingRegisters(address, length, unitID);
            if (values.length === length) {
                for (i = 0; i < length; i++) {
                    tryAndHandlePromiseOrValue(i, values);
                }
            } else {

                var error = new Error("Requested address length and response length do not match");
                callback(error);
                throw error;
            }
        }

    }
    else if (vector.getHoldingRegister) {

        for (var i = 0; i < length; i++) {
            var cb = buildCb(i);
            try {
                if (vector.getHoldingRegister.length === 3) {
                    vector.getHoldingRegister(address + i, unitID, cb);
                }
                else {
                    var promiseOrValue = vector.getHoldingRegister(address + i, unitID);
                    _handlePromiseOrValue(promiseOrValue, cb);
                }
            }
            catch (err) {
                cb(err);
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
 * @param {function} callback - callback to be invoked passing {Buffer} response
 * @returns undefined
 * @private
 */
function _handleReadInputRegisters(requestBuffer, vector, unitID, callback) {
    var address = requestBuffer.readUInt16BE(2);
    var length = requestBuffer.readUInt16BE(4);

    if (_errorRequestBufferLength(requestBuffer)) {
        return;
    }

    // build answer
    var responseBuffer = Buffer.alloc(3 + length * 2 + 2);
    responseBuffer.writeUInt8(length * 2, 2);

    var callbackInvoked = false;
    var cbCount = 0;
    var buildCb = function(i) {
        return function(err, value) {
            if (err) {
                if (!callbackInvoked) {
                    callbackInvoked = true;
                    callback(err);
                }

                return;
            }

            cbCount = cbCount + 1;

            responseBuffer.writeUInt16BE(value, 3 + i * 2);

            if (cbCount === length && !callbackInvoked) {
                modbusSerialDebug({ action: "FC4 response", responseBuffer: responseBuffer });

                callbackInvoked = true;
                callback(null, responseBuffer);
            }
        };
    };

    if (length === 0)
        callback({
            modbusErrorCode: 0x02, // Illegal address
            msg: "Invalid length"
        });

    function tryAndHandlePromiseOrValues(i, values) {
        var cb = buildCb(i);
        try {
            var promiseOrValue = values[i];
            _handlePromiseOrValue(promiseOrValue, cb);
        }
        catch (err) {
            cb(err);
        }
    }

    if (vector.getMultipleInputRegisters && length > 1) {

        if (vector.getMultipleInputRegisters.length === 4) {
            vector.getMultipleInputRegisters(address, length, unitID, function(err, values) {
                if (!err && values.length !== length) {
                    var error = new Error("Requested address length and response length do not match");
                    callback(error);
                    throw error;
                } else {
                    for (var i = 0; i < length; i++) {
                        var cb = buildCb(i);
                        try {
                            cb(err, values[i]);
                        }
                        catch (ex) {
                            cb(ex);
                        }
                    }
                }
            });
        } else {
            var values = vector.getMultipleInputRegisters(address, length, unitID);
            if (values.length === length) {
                for (var i = 0; i < length; i++) {
                    tryAndHandlePromiseOrValues(i, values);
                }
            } else {
                var error = new Error("Requested address length and response length do not match");
                callback(error);
                throw error;
            }
        }

    }
    else if (vector.getInputRegister) {

        for (i = 0; i < length; i++) {
            var cb = buildCb(i);
            try {
                if (vector.getInputRegister.length === 3) {
                    vector.getInputRegister(address + i, unitID, cb);
                }
                else {
                    var promiseOrValue = vector.getInputRegister(address + i, unitID);
                    _handlePromiseOrValue(promiseOrValue, cb);
                }
            }
            catch (ex) {
                cb(ex);
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
 * @param {function} callback - callback to be invoked passing {Buffer} response
 * @returns undefined
 * @private
 */
function _handleWriteCoil(requestBuffer, vector, unitID, callback) {
    var address = requestBuffer.readUInt16BE(2);
    var state = requestBuffer.readUInt16BE(4);

    if (_errorRequestBufferLength(requestBuffer)) {
        return;
    }

    // build answer
    var responseBuffer = Buffer.alloc(8);
    responseBuffer.writeUInt16BE(address, 2);
    responseBuffer.writeUInt16BE(state, 4);

    if (vector.setCoil) {
        var callbackInvoked = false;
        var cb = function(err) {
            if (err) {
                if (!callbackInvoked) {
                    callbackInvoked = true;
                    callback(err);
                }

                return;
            }

            if (!callbackInvoked) {
                modbusSerialDebug({ action: "FC5 response", responseBuffer: responseBuffer });

                callbackInvoked = true;
                callback(null, responseBuffer);
            }
        };

        try {
            if (vector.setCoil.length === 4) {
                vector.setCoil(address, state === 0xff00, unitID, cb);
            }
            else {
                var promiseOrValue = vector.setCoil(address, state === 0xff00, unitID);
                _handlePromiseOrValue(promiseOrValue, cb);
            }
        }
        catch(err) {
            cb(err);
        }
    }
}

/**
 * Function to handle FC6 request.
 *
 * @param requestBuffer - request Buffer from client
 * @param vector - vector of functions for read and write
 * @param unitID - Id of the requesting unit
 * @param {function} callback - callback to be invoked passing {Buffer} response
 * @returns undefined
 * @private
 */
function _handleWriteSingleRegister(requestBuffer, vector, unitID, callback) {
    var address = requestBuffer.readUInt16BE(2);
    var value = requestBuffer.readUInt16BE(4);

    if (_errorRequestBufferLength(requestBuffer)) {
        return;
    }

    // build answer
    var responseBuffer = Buffer.alloc(8);
    responseBuffer.writeUInt16BE(address, 2);
    responseBuffer.writeUInt16BE(value, 4);

    if (vector.setRegister) {
        var callbackInvoked = false;
        var cb = function(err) {
            if (err) {
                if (!callbackInvoked) {
                    callbackInvoked = true;
                    callback(err);
                }

                return;
            }

            if (!callbackInvoked) {
                modbusSerialDebug({ action: "FC6 response", responseBuffer: responseBuffer });

                callbackInvoked = true;
                callback(null, responseBuffer);
            }
        };

        try {
            if (vector.setRegister.length === 4) {
                vector.setRegister(address, value, unitID, cb);
            }
            else {
                var promiseOrValue = vector.setRegister(address, value, unitID);
                _handlePromiseOrValue(promiseOrValue, cb);
            }
        } catch(err) {
            cb(err);
        }
    }
}

/**
 * Function to handle FC15 request.
 *
 * @param requestBuffer - request Buffer from client
 * @param vector - vector of functions for read and write
 * @param unitID - Id of the requesting unit
 * @param {function} callback - callback to be invoked passing {Buffer} response
 * @returns undefined
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
    var responseBuffer = Buffer.alloc(8);
    responseBuffer.writeUInt16BE(address, 2);
    responseBuffer.writeUInt16BE(length, 4);

    if (vector.setCoil) {
        var callbackInvoked = false;
        var cbCount = 0;
        var buildCb = function(/* i - not used at the moment */) {
            return function(err) {
                if (err) {
                    if (!callbackInvoked) {
                        callbackInvoked = true;
                        callback(err);
                    }

                    return;
                }

                cbCount = cbCount + 1;

                if (cbCount === length && !callbackInvoked) {
                    modbusSerialDebug({ action: "FC15 response", responseBuffer: responseBuffer });

                    callbackInvoked = true;
                    callback(null, responseBuffer);
                }
            };
        };

        if (length === 0)
            callback({
                modbusErrorCode: 0x02, // Illegal address
                msg: "Invalid length"
            });

        var state;

        for (var i = 0; i < length; i++) {
            var cb = buildCb(i);
            state = requestBuffer.readBit(i, 7);

            try {
                if (vector.setCoil.length === 4) {
                    vector.setCoil(address + i, state !== false, unitID, cb);
                }
                else {
                    var promiseOrValue = vector.setCoil(address + i, state !== false, unitID);
                    _handlePromiseOrValue(promiseOrValue, cb);
                }
            }
            catch(err) {
                cb(err);
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
 * @param {function} callback - callback to be invoked passing {Buffer} response
 * @returns undefined
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
    var responseBuffer = Buffer.alloc(8);
    responseBuffer.writeUInt16BE(address, 2);
    responseBuffer.writeUInt16BE(length, 4);

    // write registers
    if (vector.setRegister) {
        var callbackInvoked = false;
        var cbCount = 0;
        var buildCb = function(/* i - not used at the moment */) {
            return function(err) {
                if (err) {
                    if (!callbackInvoked) {
                        callbackInvoked = true;
                        callback(err);
                    }

                    return;
                }

                cbCount = cbCount + 1;

                if (cbCount === length && !callbackInvoked) {
                    modbusSerialDebug({ action: "FC16 response", responseBuffer: responseBuffer });

                    callbackInvoked = true;
                    callback(null, responseBuffer);
                }
            };
        };

        if (length === 0)
            callback({
                modbusErrorCode: 0x02, // Illegal address
                msg: "Invalid length"
            });

        var value;

        for (var i = 0; i < length; i++) {
            var cb = buildCb(i);
            value = requestBuffer.readUInt16BE(7 + i * 2);

            try {
                if (vector.setRegister.length === 4) {
                    vector.setRegister(address + i, value, unitID, cb);
                }
                else {
                    var promiseOrValue = vector.setRegister(address + i, value, unitID);
                    _handlePromiseOrValue(promiseOrValue, cb);
                }
            }
            catch(err) {
                cb(err);
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
    var recvBuffer = Buffer.from([]);

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
            recvBuffer = Buffer.concat([recvBuffer, data], recvBuffer.length + data.length);

            while(recvBuffer.length > MBAP_LEN) {
                const transactionsId = recvBuffer.readUInt16BE(0);
                var pduLen = recvBuffer.readUInt16BE(4);

                // Check the presence of the full request (MBAP + PDU)
                if(recvBuffer.length - MBAP_LEN < pduLen)
                    break;

                // remove mbap and add crc16
                var requestBuffer = Buffer.alloc(pduLen + 2);
                recvBuffer.copy(requestBuffer, 0, MBAP_LEN, MBAP_LEN + pduLen);

                // Move receive buffer on
                recvBuffer = recvBuffer.slice(MBAP_LEN + pduLen);

                var crc = crc16(requestBuffer.slice(0, -2));
                requestBuffer.writeUInt16LE(crc, requestBuffer.length - 2);

                modbusSerialDebug({ action: "receive", data: requestBuffer, requestBufferLength: requestBuffer.length });
                modbusSerialDebug(JSON.stringify({ action: "receive", data: requestBuffer }));

                var cb = function(err, responseBuffer) {
                    if (err) {
                        modbus.emit("error", err);
                        return;
                    }

                    // send data back
                    if (responseBuffer) {
                        // remove crc and add mbap
                        var outTcp = Buffer.alloc(responseBuffer.length + 6 - 2);
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
                setTimeout(_parseModbusBuffer.bind(this, requestBuffer, vector, cb), 0);
            }
        });

        sock.on("error", function(err) {
            modbusSerialDebug(JSON.stringify({ action: "socket error", data: err }));

            modbus.emit("socketError", err);
        });
    });
    EventEmitter.call(this);
};
util.inherits(ServerTCP, EventEmitter);

/**
* Delegate the close server method to backend.
*
* @param callback
*/
ServerTCP.prototype.close = function(callback) {
    // close the net port if exist
    if (this._server) {
        this._server.removeAllListeners("data");
        this._server.close(callback);

        modbusSerialDebug({ action: "close server" });
    } else {
        modbusSerialDebug({ action: "close server", warning: "server already closed" });
    }
};

/**
 * ServerTCP interface export.
 * @type {ServerTCP}
 */
module.exports = ServerTCP;
