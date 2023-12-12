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
const net = require("net");
const modbusSerialDebug = require("debug")("modbus-serial");

const HOST = "127.0.0.1";
const UNIT_ID = 255; // listen to all adresses
const MODBUS_PORT = 502;

// Not really its official length, but we parse UnitID as part of PDU
const MBAP_LEN = 6;

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
 * @param {int} serverUnitID - the server's unitID
 * @param {function} sockWriter - write buffer (or error) to tcp socket
 * @param {object} options - the options object
 * @returns undefined
 * @private
 */
function _parseModbusBuffer(requestBuffer, vector, serverUnitID, sockWriter, options) {
    // Check requestBuffer length
    if (!requestBuffer || requestBuffer.length < MBAP_LEN) {
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
            if (options.enron) {
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
            if (options.enron) {
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

class ServerTCP extends EventEmitter {
    /**
     * Class making ModbusTCP server.
     *
     * @param vector - vector of server functions (see examples/server.js)
     * @param options - server options (host (IP), port, debug (true/false), unitID, enron? (true/false), enronTables? (object))
     * @constructor
     */
    constructor(vector, options) {
        super();

        const modbus = this;
        options = options || {};

        // create a tcp server
        modbus._server = net.createServer();
        modbus._server.on("error", function(error) {
            modbus.emit("serverError", error);
        });
        modbus._server.listen({
            port: options.port || MODBUS_PORT,
            host: options.host || HOST
        }, function() {
            modbus.emit("initialized");
        });

        // create a server unit id
        const serverUnitID = options.unitID || UNIT_ID;

        // remember open sockets
        modbus.socks = new Map();

        modbus._server.on("connection", function(sock) {
            let recvBuffer = Buffer.from([]);
            modbus.socks.set(sock, 0);

            modbusSerialDebug({
                action: "connected",
                address: sock.address(),
                remoteAddress: sock.remoteAddress,
                localPort: sock.localPort
            });

            sock.once("close", function() {
                modbusSerialDebug({
                    action: "closed"
                });
                modbus.socks.delete(sock);
            });

            sock.on("data", function(data) {
                modbusSerialDebug({ action: "socket data", data: data });
                recvBuffer = Buffer.concat([recvBuffer, data], recvBuffer.length + data.length);

                while(recvBuffer.length > MBAP_LEN) {
                    const transactionsId = recvBuffer.readUInt16BE(0);
                    const pduLen = recvBuffer.readUInt16BE(4);

                    // Check the presence of the full request (MBAP + PDU)
                    if(recvBuffer.length - MBAP_LEN < pduLen)
                        break;

                    // remove mbap and add crc16
                    const requestBuffer = Buffer.alloc(pduLen + 2);
                    recvBuffer.copy(requestBuffer, 0, MBAP_LEN, MBAP_LEN + pduLen);

                    // Move receive buffer on
                    recvBuffer = recvBuffer.slice(MBAP_LEN + pduLen);

                    const crc = crc16(requestBuffer.slice(0, -2));
                    requestBuffer.writeUInt16LE(crc, requestBuffer.length - 2);

                    modbusSerialDebug({ action: "receive", data: requestBuffer, requestBufferLength: requestBuffer.length });
                    modbusSerialDebug(JSON.stringify({ action: "receive", data: requestBuffer }));

                    const sockWriter = function(err, responseBuffer) {
                        if (err) {
                            modbus.emit("error", err);
                            return;
                        }

                        // send data back
                        if (responseBuffer) {
                            // remove crc and add mbap
                            const outTcp = Buffer.alloc(responseBuffer.length + 6 - 2);
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

            sock.on("error", function(err) {
                modbusSerialDebug(JSON.stringify({ action: "socket error", data: err }));

                modbus.emit("socketError", err);
            });
        });
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
            modbus._server.close(callback);

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
 * ServerTCP interface export.
 * @type {ServerTCP}
 */
module.exports = ServerTCP;
