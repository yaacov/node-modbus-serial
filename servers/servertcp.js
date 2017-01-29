'use strict';
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
 var util = require('util');
 var events = require('events');
 var EventEmitter = events.EventEmitter || events;
 var net = require('net');

 var HOST = '127.0.0.1';
 var MODBUS_PORT = 502;

/* Add bit operation functions to Buffer
 */
require('../utils/buffer_bit')();
var crc16 = require('./../utils/crc16');

/**
 * Parse a modbusRTU buffer and return an answer buffer
 */
function parseModbusBuffer(buf, vector) {
    var ansBuf = null;
    var unitNumber = buf[0];
    var functionCode = buf[1];
    var crc = buf[buf.length - 2] + buf[buf.length - 1] * 0x100;

    // if crc is bad, ignore message
    if (crc != crc16(buf.slice(0, -2))) {
        return;
    }

    // function code 1 and 2
    if (functionCode == 1 || functionCode == 2) {
        var address = buf.readUInt16BE(2);
        var length = buf.readUInt16BE(4);

        // if length is bad, ignore message
        if (buf.length != 8) {
            return;
        }

        // build answer
        ansBuf = new Buffer(3 + parseInt((length - 1) / 8 + 1) + 2);
        ansBuf.writeUInt8(parseInt((length - 1) / 8 + 1), 2);

        // read coils
        if (vector.getCoil) {
            for (var i = 0; i < length; i++) {
              ansBuf.writeBit(vector.getCoil(address + i), i, 3);
            }
        }
    }

    // function code 3
    if (functionCode == 3) {
        var address = buf.readUInt16BE(2);
        var length = buf.readUInt16BE(4);

        // if length is bad, ignore message
        if (buf.length != 8) {
            return;
        }

        // build answer
        ansBuf = new Buffer(3 + length * 2 + 2);
        ansBuf.writeUInt8(length * 2, 2);

        // read registers
        if (vector.getHoldingRegister) {
          for (var i = 0; i < length; i++) {
              ansBuf.writeUInt16BE(vector.getHoldingRegister(address + i), 3 + i * 2);
          }
        }
    }

    // function code 4
    if (functionCode == 4) {
        var address = buf.readUInt16BE(2);
        var length = buf.readUInt16BE(4);

        // if length is bad, ignore message
        if (buf.length != 8) {
            return;
        }

        // build answer
        ansBuf = new Buffer(3 + length * 2 + 2);
        ansBuf.writeUInt8(length * 2, 2);

        // read registers
        if (vector.getInputRegister) {
          for (var i = 0; i < length; i++) {
              ansBuf.writeUInt16BE(vector.getInputRegister(address + i), 3 + i * 2);
          }
        }
    }

    // function code 5
    if (functionCode == 5) {
        var address = buf.readUInt16BE(2);
        var state = buf.readUInt16BE(4);

        // if length is bad, ignore message
        if (buf.length != 8) {
            return;
        }

        // build answer
        ansBuf = new Buffer(8);
        ansBuf.writeUInt16BE(address, 2);
        ansBuf.writeUInt16BE(state, 4);

        // write coil
        if (vector.setCoil) {
            vector.setCoil(address, state === 0xff00);
        }
    }

    // function code 6
    if (functionCode == 6) {
        var address = buf.readUInt16BE(2);
        var value = buf.readUInt16BE(4);
        // if length is bad, ignore message
        if (buf.length != (6 + 2)) {
            return;
        }

        // build answer
        ansBuf = new Buffer(8);
        ansBuf.writeUInt16BE(address, 2);
        ansBuf.writeUInt16BE(value, 4);

        if (vector.setRegister) vector.setRegister(address, value);
    }

    // function code 15
    if (functionCode == 15) {
        var address = buf.readUInt16BE(2);
        var length = buf.readUInt16BE(4);

        // if length is bad, ignore message
        if (buf.length != 7 + Math.ceil(length / 8) + 2) {
            return;
        }

        // build answer
        ansBuf = new Buffer(8);
        ansBuf.writeUInt16BE(address, 2);
        ansBuf.writeUInt16BE(length, 4);

        // write coils
        if (vector.setCoil) {
            for (var i = 0; i < length; i++) {
                var state = buf.readBit(i, 7);
                vector.setCoil(address + i, state !== 0);
            }
        }
    }

    // function code 16
    if (functionCode == 16) {
        var address = buf.readUInt16BE(2);
        var length = buf.readUInt16BE(4);

        // if length is bad, ignore message
        if (buf.length != (7 + length * 2 + 2)) {
            return;
        }

        // build answer
        ansBuf = new Buffer(8);
        ansBuf.writeUInt16BE(address, 2);
        ansBuf.writeUInt16BE(length, 4);

        // write registers
        if (vector.setRegister) {
            for (var i = 0; i < length; i++) {
                var value = buf.readUInt16BE(7 + i * 2);
                vector.setRegister(address + i, value);
            }
        }
    }

    // add unit-id, function code and crc
    if (ansBuf) {
        // add unit number and function code
        ansBuf.writeUInt8(unitNumber, 0);
        ansBuf.writeUInt8(functionCode, 1);

        // add crc
        crc = crc16(ansBuf.slice(0, -2));
        ansBuf.writeUInt16LE(crc, ansBuf.length - 2);
    }

    return ansBuf;
}

/**
 * Class making ModbusTCP server
 *
 * @param {object} options the server options
 */
var ServerTCP = function (vector, options) {
    var modbus = this;
    modbus._unitID = options.unitID || 1;
    modbus.debug = options.debug || false;

    // create a tcp server
    modbus._server = net.createServer();
    modbus._server.listen(options.port || MODBUS_PORT, options.host || HOST);

    modbus._server.on('connection', function(sock) {
        // emit debug data
        if (modbus.debug) modbus.emit('debug', {action: 'connected', data: null});

        sock.on('data', function (data) {
            // remove mbap and add crc16
            var buf = new Buffer(data.length - 6 + 2);
            data.copy(buf, 0, 6);
            var crc = crc16(buf.slice(0, -2));
            buf.writeUInt16LE(crc, buf.length - 2);

            // emit debug data
            if (modbus.debug) modbus.emit('debug', {action: 'recive', data: buf});

            // if length is too short, ignore message
            if (buf.length < 8) {
                return;
            }

            // parse the modbusRTU buffer
            var ansBuf = parseModbusBuffer(buf, vector);

            // send data back
            if (ansBuf) {
                // get transaction id
                var transactionsId = data.readUInt16BE(0);

                // remove crc and add mbap
                var outTcp = new Buffer(ansBuf.length + 6 - 2);
                outTcp.writeUInt16BE(transactionsId, 0);
                outTcp.writeUInt16BE(0, 2);
                outTcp.writeUInt16BE(ansBuf.length - 2, 4);
                ansBuf.copy(outTcp, 6);

                // emit debug data
                if (modbus.debug) modbus.emit('debug', {action: 'send', data: ansBuf});

                // write to port
                sock.write(outTcp);
            }
        });
    });
    EventEmitter.call(this);
};
util.inherits(ServerTCP, EventEmitter);

module.exports = ServerTCP;
