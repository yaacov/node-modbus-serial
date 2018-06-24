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

var modbusSerialDebug = require("debug")("modbus-serial");

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
 * Exports
 */
module.exports = {
    readCoilsOrInputDiscretes: _handleReadCoilsOrInputDiscretes,
    readMultipleRegisters: _handleReadMultipleRegisters,
    readInputRegisters: _handleReadInputRegisters,
    writeCoil: _handleWriteCoil,
    writeSingleRegister: _handleWriteSingleRegister,
    forceMultipleCoils: _handleForceMultipleCoils,
    writeMultipleRegisters: _handleWriteMultipleRegisters
};
