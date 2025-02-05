/* eslint-disable no-var */
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

const modbusSerialDebug = require("debug")("modbus-serial");

/**
 * Check the length of request Buffer for length of 8.
 *
 * @param requestBuffer - request Buffer from client
 * @returns {boolean} - if error it is true, otherwise false
 * @private
 */
function _errorRequestBufferLength(requestBuffer) {

    if (requestBuffer.length !== 8) {
        modbusSerialDebug("request Buffer length " + requestBuffer.length + " is wrong - has to be == 8");
        return true;
    }

    return false; // length is okay - no error
}

/**
 * Check the length of request Buffer for length of 8.
 *
 * @param requestBuffer - request Buffer from client
 * @returns {boolean} - if error it is true, otherwise false
 * @private
 */
function _errorRequestBufferLengthEnron(requestBuffer) {

    if (requestBuffer.length !== 10) {
        modbusSerialDebug("request (Enron) Buffer length " + requestBuffer.length + " is wrong - has to be == 10");
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
        promiseOrValue
            .then(function(value) {
                cb(null, value);
            })
            .catch(function(err) {
                cb(err);
            });
    }  else {
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
    const address = requestBuffer.readUInt16BE(2);
    const length = requestBuffer.readUInt16BE(4);

    if (_errorRequestBufferLength(requestBuffer)) {
        return;
    }

    // build answer
    const dataBytes = parseInt((length - 1) / 8 + 1);
    const responseBuffer = Buffer.alloc(3 + dataBytes + 2);
    try {
        responseBuffer.writeUInt8(dataBytes, 2);
    }
    catch (err) {
        callback(err);
        return;
    }

    const isGetCoil = (fc === 1 && vector.getCoil);
    const isGetDiscreteInpupt = (fc === 2 && vector.getDiscreteInput);

    // read coils
    if (isGetCoil || isGetDiscreteInpupt) {
        let callbackInvoked = false;
        let cbCount = 0;
        const buildCb = function(i) {
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

        let i = 0;
        let cb = null;
        let promiseOrValue = null;

        if (isGetCoil && vector.getCoil.length === 3) {
            for (i = 0; i < length; i++) {
                cb = buildCb(i);
                try {
                    vector.getCoil(address + i, unitID, cb);
                }
                catch(err) {
                    cb(err);
                }
            }
        }
        else if (isGetDiscreteInpupt && vector.getDiscreteInput.length === 3) {
            for (i = 0; i < length; i++) {
                cb = buildCb(i);
                try {
                    vector.getDiscreteInput(address + i, unitID, cb);
                }
                catch(err) {
                    cb(err);
                }
            }
        }
        else if (isGetCoil) {
            for (i = 0; i < length; i++) {
                cb = buildCb(i);
                try {
                    promiseOrValue = vector.getCoil(address + i, unitID);
                    _handlePromiseOrValue(promiseOrValue, cb);
                }
                catch(err) {
                    cb(err);
                }
            }
        }
        else if (isGetDiscreteInpupt) {
            for (i = 0; i < length; i++) {
                cb = buildCb(i);
                try {
                    promiseOrValue = vector.getDiscreteInput(address + i, unitID);
                    _handlePromiseOrValue(promiseOrValue, cb);
                }
                catch(err) {
                    cb(err);
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
 * @param {function} callback - callback to be invoked passing {Buffer} response
 * @returns undefined
 * @private
 */
function _handleReadMultipleRegisters(requestBuffer, vector, unitID, callback) {
    const valueSize = 2;
    const address = requestBuffer.readUInt16BE(2);
    const length = requestBuffer.readUInt16BE(4);

    if (_errorRequestBufferLength(requestBuffer)) {
        return;
    }

    // build answer
    const responseBuffer = Buffer.alloc(3 + (length * valueSize) + 2);
    try {
        responseBuffer.writeUInt8(length * valueSize, 2);
    }
    catch (err) {
        callback(err);
        return;
    }

    let callbackInvoked = false;
    let cbCount = 0;
    const buildCb = function(i) {
        return function(err, value) {
            if (err) {
                if (!callbackInvoked) {
                    callbackInvoked = true;
                    callback(err);
                }

                return;
            }

            cbCount = cbCount + 1;

            responseBuffer.writeUInt16BE(value, 3 + (i * valueSize));

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
        const cb = buildCb(i);
        try {
            const promiseOrValue = values[i];
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
                    const error = new Error("Requested address length and response length do not match");
                    callback(error);
                } else if (err) {
                    const cb = buildCb(i);
                    try {
                        cb(err); // no need to use value array if there is an error
                    }
                    catch (ex) {
                        cb(ex);
                    }
                }
                else {
                    for (var i = 0; i < length; i++) {
                        const cb = buildCb(i);
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
            let values;
            try {
                values = vector.getMultipleHoldingRegisters(address, length, unitID);
            } catch (error) {
                callback(error);
                return;
            }
            if (values.length === length) {
                for (i = 0; i < length; i++) {
                    tryAndHandlePromiseOrValue(i, values);
                }
            } else {
                const error = new Error("Requested address length and response length do not match");
                callback(error);
            }
        }

    }
    else if (vector.getHoldingRegister) {
        for (var i = 0; i < length; i++) {
            const cb = buildCb(i);
            try {
                if (vector.getHoldingRegister.length === 3) {
                    vector.getHoldingRegister(address + i, unitID, cb);
                } else {
                    const promiseOrValue = vector.getHoldingRegister(address + i, unitID);
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
 * Function to handle FC3 request.
 *
 * @param requestBuffer - request Buffer from client
 * @param vector - vector of functions for read and write
 * @param unitID - Id of the requesting unit
 * @param enronTables - The enron tables definition
 * @param {function} callback - callback to be invoked passing {Buffer} response
 * @returns undefined
 * @private
 */
function _handleReadMultipleRegistersEnron(requestBuffer, vector, unitID, enronTables, callback) {
    const valueSize = 4;
    const address = requestBuffer.readUInt16BE(2);
    const length = requestBuffer.readUInt16BE(4);

    // Fall back to 16 bit for short integer variables
    if (address >= enronTables.shortRange[0] && address <= enronTables.shortRange[1]) {
        return _handleReadMultipleRegisters(requestBuffer, vector, unitID, callback);
    }

    if (_errorRequestBufferLength(requestBuffer)) {
        return;
    }

    // build answer
    const responseBuffer = Buffer.alloc(3 + (length * valueSize) + 2);
    try {
        responseBuffer.writeUInt8(length * valueSize, 2);
    }
    catch (err) {
        callback(err);
        return;
    }

    let callbackInvoked = false;
    let cbCount = 0;
    const buildCb = function(i) {
        return function(err, value) {
            if (err) {
                if (!callbackInvoked) {
                    callbackInvoked = true;
                    callback(err);
                }

                return;
            }

            cbCount = cbCount + 1;

            responseBuffer.writeUInt32BE(value, 3 + (i * valueSize));

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
        const cb = buildCb(i);
        try {
            const promiseOrValue = values[i];
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
                    const error = new Error("Requested address length and response length do not match");
                    callback(error);
                } else if (err) {
                    const cb = buildCb(i);
                    try {
                        cb(err); // no need to use value array if there is an error
                    }
                    catch (ex) {
                        cb(ex);
                    }
                }
                else {
                    for (var i = 0; i < length; i++) {
                        const cb = buildCb(i);
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
            let values;
            try {
                values = vector.getMultipleHoldingRegisters(address, length, unitID);
            } catch (error) {
                callback(error);
                return;
            }
            if (values.length === length) {
                for (i = 0; i < length; i++) {
                    tryAndHandlePromiseOrValue(i, values);
                }
            } else {
                const error = new Error("Requested address length and response length do not match");
                callback(error);
            }
        }

    }
    else if (vector.getHoldingRegister) {
        for (var i = 0; i < length; i++) {
            const cb = buildCb(i);
            try {
                if (vector.getHoldingRegister.length === 3) {
                    vector.getHoldingRegister(address + i, unitID, cb);
                } else {
                    const promiseOrValue = vector.getHoldingRegister(address + i, unitID);
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
    const address = requestBuffer.readUInt16BE(2);
    const length = requestBuffer.readUInt16BE(4);

    if (_errorRequestBufferLength(requestBuffer)) {
        return;
    }

    // build answer
    const responseBuffer = Buffer.alloc(3 + length * 2 + 2);
    try {
        responseBuffer.writeUInt8(length * 2, 2);
    }
    catch (err) {
        callback(err);
        return;
    }

    let callbackInvoked = false;
    let cbCount = 0;
    const buildCb = function(i) {
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
        const cb = buildCb(i);
        try {
            const promiseOrValue = values[i];
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
                    const error = new Error("Requested address length and response length do not match");
                    callback(error);
                } else {
                    for (let i = 0; i < length; i++) {
                        const cb = buildCb(i);
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
            let values;

            try {
                values = vector.getMultipleInputRegisters(address, length, unitID);
            } catch (error) {
                callback(error);
                return;
            }

            if (values.length === length) {
                for (var i = 0; i < length; i++) {
                    tryAndHandlePromiseOrValues(i, values);
                }
            } else {
                const error = new Error("Requested address length and response length do not match");
                callback(error);
            }
        }

    }
    else if (vector.getInputRegister) {

        for (i = 0; i < length; i++) {
            const cb = buildCb(i);
            try {
                if (vector.getInputRegister.length === 3) {
                    vector.getInputRegister(address + i, unitID, cb);
                }
                else {
                    const promiseOrValue = vector.getInputRegister(address + i, unitID);
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
    const address = requestBuffer.readUInt16BE(2);
    const state = requestBuffer.readUInt16BE(4);

    if (_errorRequestBufferLength(requestBuffer)) {
        return;
    }

    // build answer
    const responseBuffer = Buffer.alloc(8);
    responseBuffer.writeUInt16BE(address, 2);
    responseBuffer.writeUInt16BE(state, 4);

    if (vector.setCoil) {
        let callbackInvoked = false;
        const cb = function(err) {
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
                const promiseOrValue = vector.setCoil(address, state === 0xff00, unitID);
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
    const address = requestBuffer.readUInt16BE(2);
    const value = requestBuffer.readUInt16BE(4);

    if (_errorRequestBufferLength(requestBuffer)) {
        return;
    }

    // build answer
    const responseBuffer = Buffer.alloc(8);
    responseBuffer.writeUInt16BE(address, 2);
    responseBuffer.writeUInt16BE(value, 4);

    if (vector.setRegister) {
        let callbackInvoked = false;
        const cb = function(err) {
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
                const promiseOrValue = vector.setRegister(address, value, unitID);
                _handlePromiseOrValue(promiseOrValue, cb);
            }
        } catch(err) {
            cb(err);
        }
    }
}

/**
 * Function to handle FC6 (Enron) request.
 *
 * @param requestBuffer - request Buffer from client
 * @param vector - vector of functions for read and write
 * @param unitID - Id of the requesting unit
 * @param enronTables - The enron tables definition
 * @param {function} callback - callback to be invoked passing {Buffer} response
 * @returns undefined
 * @private
 */
function _handleWriteSingleRegisterEnron(requestBuffer, vector, unitID, enronTables, callback) {
    const address = requestBuffer.readUInt16BE(2);
    const value = requestBuffer.readUInt32BE(4);

    // Fall back to 16 bit for short integer variables
    if (address >= enronTables.shortRange[0] && address <= enronTables.shortRange[1]) {
        return _handleWriteSingleRegister(requestBuffer, vector, unitID, callback);
    }

    if (_errorRequestBufferLengthEnron(requestBuffer)) {
        return;
    }

    // build answer
    const responseBuffer = Buffer.alloc(10);
    responseBuffer.writeUInt16BE(address, 2);
    responseBuffer.writeUInt32BE(value, 4);

    if (vector.setRegister) {
        let callbackInvoked = false;
        const cb = function(err) {
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
                const promiseOrValue = vector.setRegister(address, value, unitID);
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
    const address = requestBuffer.readUInt16BE(2);
    const length = requestBuffer.readUInt16BE(4);

    // if length is bad, ignore message
    if (requestBuffer.length !== 7 + Math.ceil(length / 8) + 2) {
        return;
    }

    // build answer
    const responseBuffer = Buffer.alloc(8);
    responseBuffer.writeUInt16BE(address, 2);
    responseBuffer.writeUInt16BE(length, 4);

    let callbackInvoked = false;
    let cbCount = 0;
    const buildCb = function(/* i - not used at the moment */) {
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

    if (vector.setCoilArray) {
        const state = [];

        for (i = 0; i < length; i++) {
            cb = buildCb(i);
            state.push(requestBuffer.readBit(i, 7));
            _handlePromiseOrValue(promiseOrValue, cb);
        }

        try {
            if (vector.setCoilArray.length === 4) {
                vector.setCoilArray(address, state, unitID, cb);
            }
            else {
                vector.setCoilArray(address, state, unitID);
            }
        }
        catch(err) {
            cb(err);
        }
    } else if (vector.setCoil) {
        let state;

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
    const address = requestBuffer.readUInt16BE(2);
    const length = requestBuffer.readUInt16BE(4);

    // if length is bad, ignore message
    if (requestBuffer.length !== (7 + length * 2 + 2)) {
        return;
    }

    // build answer
    const responseBuffer = Buffer.alloc(8);
    responseBuffer.writeUInt16BE(address, 2);
    responseBuffer.writeUInt16BE(length, 4);

    // write registers
    let callbackInvoked = false;
    const cb = function(err) {
        if (err) {
            if (!callbackInvoked) {
                callbackInvoked = true;
                callback(err);
            }

            return;
        }

        if (!callbackInvoked) {
            modbusSerialDebug({ action: "FC16 response", responseBuffer: responseBuffer });

            callbackInvoked = true;
            callback(null, responseBuffer);
        }
    };

    if (length === 0)
        callback({
            modbusErrorCode: 0x02, // Illegal address
            msg: "Invalid length"
        });
    if (vector.setRegisterArray) {
        value = [];

        try {
            for (i = 0; i < length; i++) {
                value.push(requestBuffer.readUInt16BE(7 + i * 2));
            }

            if (vector.setRegisterArray.length === 4) {
                vector.setRegisterArray(address, value, unitID, cb);
            }
            else {
                var promiseOrValue = vector.setRegisterArray(address, value, unitID);
                _handlePromiseOrValue(promiseOrValue, cb);
            }
        }
        catch (err) {
            cb(err);
        }
    } else if (vector.setRegister) {
        var value;

        for (var i = 0; i < length; i++) {
            try {
                value = requestBuffer.readUInt16BE(7 + i * 2);

                if (vector.setRegister.length === 4) {
                    vector.setRegister(address + i, value, unitID, cb);
                }
                else {
                    const promiseOrValue = vector.setRegister(address + i, value, unitID);
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
 * Function to handle FC17 request.
 *
 * @param requestBuffer - request Buffer from client
 * @param vector - vector of functions for read and write
 * @param unitID - Id of the requesting unit
 * @param {function} callback - callback to be invoked passing {Buffer} response
 * @returns undefined
 * @private
 */
function _handleReportServerID(requestBuffer, vector, unitID, callback) {
    if(!vector.reportServerID) {
        callback({ modbusErrorCode: 0x01 });
        return;
    }

    // build answer
    const promiseOrValue = vector.reportServerID(unitID);
    _handlePromiseOrValue(promiseOrValue, function(err, value) {
        if(err) {
            callback(err);
            return;
        }
        if (!value) {
            callback({ modbusErrorCode: 0x01, msg: "Report Server ID not supported by device" });
            return;
        }
        if (!value.id || !value.running) {
            callback({ modbusErrorCode: 0x04, msg: "Invalid content provided for Report Server ID: " + JSON.stringify(value) });
            return;
        }
        const id = value.id;
        const running = value.running;
        const additionalData = value.additionalData;
        let contentLength = 2; // serverID + Running
        if (additionalData) {
            contentLength += additionalData.length;
        }
        const totalLength = 3 + contentLength + 2; // UnitID + FC + Byte-Count + Content-Length + CRC

        let i = 2;
        const responseBuffer = Buffer.alloc(totalLength);
        i = responseBuffer.writeUInt8(contentLength, i);
        i = responseBuffer.writeUInt8(id, i);
        if (running === true) {
            i = responseBuffer.writeUInt8(0xFF, i);
        } else {
            i += 1;
        }
        if (additionalData) {
            additionalData.copy(responseBuffer, i);
        }
        callback(null, responseBuffer);
    });
}

/**
 * Function to handle FC43 request.
 *
 * @param requestBuffer - request Buffer from client
 * @param vector - vector of functions for read and write
 * @param unitID - Id of the requesting unit
 * @param {function} callback - callback to be invoked passing {Buffer} response
 * @returns undefined
 * @private
 */
function _handleMEI(requestBuffer, vector, unitID, callback) {
    const MEIType = requestBuffer[2];
    switch(parseInt(MEIType)) {
        case 14:
            _handleReadDeviceIdentification(requestBuffer, vector, unitID, callback);
            break;
        default:
            callback({ modbusErrorCode: 0x01 }); // illegal MEI type
    }
}

/**
 * Function to handle FC43/14 MEI request.
 *
 * @param requestBuffer - request Buffer from client
 * @param vector - vector of functions for read and write
 * @param unitID - Id of the requesting unit
 * @param {function} callback - callback to be invoked passing {Buffer} response
 * @returns undefined
 * @private
 */
function _handleReadDeviceIdentification(requestBuffer, vector, unitID, callback) {
    const PDULenMax = 253;
    const MEI14HeaderLen = 6;
    const stringLengthMax = PDULenMax - MEI14HeaderLen - 2;

    if(!vector.readDeviceIdentification) {
        callback({ modbusErrorCode: 0x01 });
        return;
    }

    const readDeviceIDCode = requestBuffer.readUInt8(3);
    let objectID = requestBuffer.readUInt8(4);

    // Basic request parameters checks
    switch(readDeviceIDCode) {
        case 0x01:
            if(objectID > 0x02 || (objectID > 0x06 && objectID < 0x80))
                objectID = 0x00;
            break;

        case 0x02:
            if(objectID >= 0x80 || (objectID > 0x06 && objectID < 0x80))
                objectID = 0x00;
            break;

        case 0x03:
            if(objectID > 0x06 && objectID < 0x80)
                objectID = 0x00;
            break;

        case 0x04:
            if(objectID > 0x06 && objectID < 0x80) {
                callback({ modbusErrorCode: 0x02 });
                return;
            }
            break;

        default:
            callback({ modbusErrorCode: 0x03 });
            return;
    }

    // Filling mandatory basic device identification objects
    const objects = {
        0x00: "undefined",
        0x01: "undefined",
        0x02: "undefined"
    };

    const pkg = require("../package.json");
    if(pkg) {
        if(pkg.author)
            objects[0x00] = pkg.author;
        if(pkg.name)
            objects[0x01] = pkg.name;
        if(pkg.version)
            objects[0x02] = pkg.version;
    }

    const promiseOrValue = vector.readDeviceIdentification(unitID);
    _handlePromiseOrValue(promiseOrValue, function(err, value) {
        if(err) {
            callback(err);
            return;
        }

        const userObjects = value;

        for(const o of Object.keys(userObjects)) {
            const i = parseInt(o);
            if(!isNaN(i) && i >= 0 && i <= 255)
                objects[i] = userObjects[o];
        }

        // Checking the existence of the requested objectID
        if(!objects[objectID]) {
            if(readDeviceIDCode === 0x04) {
                callback({ modbusErrorCode: 0x02 });
                return;
            }

            objectID = 0x00;
        }

        const ids = [];
        let totalLength = 2 + MEI14HeaderLen + 2; // UnitID + FC + MEI14Header + CRC
        let lastID = 0;
        let conformityLevel = 0x81;

        const supportedIDs = Object.keys(objects);

        // Filtering of objects and Conformity level determination
        for(var id of supportedIDs) {
            id = parseInt(id);

            if(isNaN(id))
                continue;

            // Enforcing valid object IDs from the user
            if(id < 0x00 || (id > 0x06 && id < 0x80) || id > 0xFF) {
                callback({ modbusErrorCode: 0x04, msg: "Invalid Object ID provided for Read Device Identification: " + id });
            }

            if(id > 0x02)
                conformityLevel = 0x82;
            if(id > 0x80)
                conformityLevel = 0x83;

            // Starting from requested object ID
            if(objectID > id)
                continue;

            // Enforcing maximum string length
            if(objects[id].length > stringLengthMax) {
                callback({ modbusErrorCode: 0x04,
                    msg: "Read Device Identification string size can be maximum " +
                                stringLengthMax });
            }

            if(lastID !== 0)
                continue;

            if(objects[id].length + 2 > PDULenMax - totalLength) {
                if(lastID === 0)
                    lastID = id;
            }
            else {
                totalLength += objects[id].length + 2;
                ids.push(id);

                // Requested a single object
                if(readDeviceIDCode === 0x04)
                    break;
            }
        }

        ids.sort((a, b) => parseInt(a) - parseInt(b));
        const responseBuffer = Buffer.alloc(totalLength);

        let i = 2;
        i = responseBuffer.writeUInt8(14, i);                                   // MEI type
        i = responseBuffer.writeUInt8(readDeviceIDCode, i);
        i = responseBuffer.writeUInt8(conformityLevel, i);
        if(lastID === 0)                                                        // More follows
            i = responseBuffer.writeUInt8(0x00, i);
        else
            i = responseBuffer.writeUInt8(0xFF, i);

        i = responseBuffer.writeUInt8(lastID, i);                               // Next Object Id
        i = responseBuffer.writeUInt8(ids.length, i);                           // Number of objects

        for(id of ids) {
            i = responseBuffer.writeUInt8(id, i);                               // Object id
            i = responseBuffer.writeUInt8(objects[id].length, i);               // Object length
            i += responseBuffer.write(objects[id], i, objects[id].length);      // Object value
        }

        callback(null, responseBuffer);
    });
}

/**
 * Exports
 */
module.exports = {
    readCoilsOrInputDiscretes: _handleReadCoilsOrInputDiscretes,
    readMultipleRegisters: _handleReadMultipleRegisters,
    readMultipleRegistersEnron: _handleReadMultipleRegistersEnron,
    readInputRegisters: _handleReadInputRegisters,
    writeCoil: _handleWriteCoil,
    writeSingleRegister: _handleWriteSingleRegister,
    writeSingleRegisterEnron: _handleWriteSingleRegisterEnron,
    forceMultipleCoils: _handleForceMultipleCoils,
    writeMultipleRegisters: _handleWriteMultipleRegisters,
    reportServerID: _handleReportServerID,
    handleMEI: _handleMEI
};
