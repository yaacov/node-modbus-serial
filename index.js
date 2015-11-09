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
 * @fileoverview ModbusRTU module, exports the ModbusRTU class.
 * this class makes ModbusRTU calls fun and easy.
 *
 * Modbus is a serial communications protocol, first used in 1979.
 * Modbus is simple and robust, openly published, royalty-free and 
 * easy to deploy and maintain.
 */
 
/** 
 * Calculate buffer CRC16 and add it to the
 * end of the buffer.
 *
 * @param {buffer} buf the data buffer.
 * @param {number} length the length of the buffer without CRC.
 *
 * @return {number} the calculated CRC16
 */
function _CRC16(buf, length) {
    var crc = 0xFFFF;
    var tmp;
    
    // calculate crc16
    for (var i = 0; i < length; i++) {
        crc = crc ^ buf[i];
        
        for (var j = 0; j < 8; j++) {
            tmp = crc & 0x0001;
            crc = crc >> 1;
            if (tmp) {
              crc = crc ^ 0xA001;
            }
        }
    }
    
    // add to end of buffer
    buf.writeUInt16LE(crc, length);
    
    // return the crc
    return crc;
}

/** 
 * Parse the data for a Modbus -
 * Read Input Registers (FC=04,03)
 *
 * @param {buffer} data the data buffer to parse.
 * @param {function} next the function to call next.
 */
function _readFC4(data, next) {
    var length = data.readUInt8(2);
    var contents = [];
    
    for (var i = 0; i < length; i += 2) {
        var reg = data.readUInt16BE(i + 3);
        contents.push(reg);
    }
    
    if (next)
        next(null, {"data": contents, "buffer": data.slice(3, 3 + length)});
}

/** 
 * Parse the data for a Modbus -
 * Preset Multiple Registers (FC=16)
 *
 * @param {buffer} data the data buffer to parse.
 * @param {function} next the function to call next.
 */
function _readFC16(data, next) {
    var dataAddress = data.readUInt16BE(2);
    var length = data.readUInt16BE(4);
    
    if (next)
        next(null, {"address": dataAddress, "length": length});
}

/**
 * Class making ModbusRTU calls fun and easy.
 *
 * @param {SerialPort} port the serial port to use.
 */
var ModbusRTU = function (port) {
    // the serial port to use
    this._port = port;
    
    // state variables
    this._nextAddress = null; // unit address of current function call.
    this._nextCode = null; // function code of current function call.
    this._nextLength = 0; // number of bytes in current answer.
    this._next = null; // the function to call on success or failure
};

/**
 * Open the serial port and register Modbus parsers
 *
 * @param {function} callback the function to call next on open success
 *      of failure.
 */
ModbusRTU.prototype.open = function (callback) {
    var modbus = this;
    
    // open the serial port
    modbus._port.open(function (error) {
        if (error) {
            /* On serial port open error
            * call next function
            */
            if (callback)
                callback(error);
        } else {
            /* On serial port open OK
             * call next function
             */
            if (callback)
                callback(error);
            
            /* On serial port success 
             * register the modbus parser functions
             */
            modbus._port.on('data', function(data) {
                // set locale helpers variables
                var length = modbus._nextLength;
                var next =  modbus._next;
                
                /* check incoming data
                 */
                 
                /* check message length
                 * if we do not expect this data
                 * raise an error
                 */
                if (data.length != length) {
                    error = "Data length error";
                    if (next)
                        next(error);
                    return;
                }
                
                var address = data.readUInt8(0);
                var code = data.readUInt8(1);
                
                /* check message address and code
                 * if we do not expect this message
                 * raise an error
                 */
                if (address != modbus._nextAddress || code != modbus._nextCode) {
                    error = "Unexpected data error";
                    if (next)
                        next(error);
                    return;
                }
                
                // data is OK - clear state variables
                modbus._nextAddress = null;
                modbus._nextCode = null;
                modbus._next = null;
                
                /* check message CRC
                 * if CRC is bad raise an error
                 */
                var crcIn = data.readUInt16LE(length - 2);
                var crc = _CRC16(data, length - 2)
                if (crcIn != crc) {
                    error = "CRC error";
                    if (next)
                        next(error);
                    return;
                }
                
                /* parse incoming data
                 */
                 
                /* Read Input Registers (FC=04)
                 * Read Holding Registers (FC=03)
                 */
                if (code == 4 || code == 3) {
                    _readFC4(data, next);
                }
                
                // Preset Multiple Registers (FC=16)
                if (code == 16) {
                    _readFC16(data, next);
                }
            });
        }
    });
};

/** 
 * Write a Modbus "Read Holding Registers" (FC=03) to serial port.
 *
 * @param {number} address the slave unit address.
 * @param {number} dataAddress the Data Address of the first register.
 * @param {number} length the total number of registers requested.
 * @param {function} next the function to call next.
 */
ModbusRTU.prototype.writeFC3 = function (address, dataAddress, length, next) {
    this.writeFC4(address, dataAddress, length, next, 3);
}

/** 
 * Write a Modbus "Read Input Registers" (FC=04) to serial port.
 *
 * @param {number} address the slave unit address.
 * @param {number} dataAddress the Data Address of the first register.
 * @param {number} length the total number of registers requested.
 * @param {function} next the function to call next.
 */
ModbusRTU.prototype.writeFC4 = function (address, dataAddress, length, next, code) {
    // function code defaults to 4
    if (!code) code = 4;
    
    // set state variables
    this._nextAddress = address;
    this._nextCode = code;
    this._nextLength = 3 + 2 * length + 2;
    this._next = next;
    
    var codeLength = 6;
    var buf = new Buffer(codeLength + 2); // add 2 crc bytes
    
    buf.writeUInt8(address, 0);
    buf.writeUInt8(code, 1);
    buf.writeUInt16BE(dataAddress, 2);
    buf.writeUInt16BE(length, 4);
    
    // add crc bytes to buffer
    _CRC16(buf, codeLength);
    
    // write buffer to serial port
    this._port.write(buf);
}

/** 
 * Write a Modbus "Preset Multiple Registers" (FC=16) to serial port.
 *
 * @param {number} address the slave unit address.
 * @param {number} dataAddress the Data Address of the first register.
 * @param {array} array the array of values to write to registers.
 * @param {function} next the function to call next.
 */
ModbusRTU.prototype.writeFC16 =  function (address, dataAddress, array, next) {
    var code = 16;
    
    // set state variables
    this._nextAddress = address;
    this._nextCode = code;
    this._nextLength = 8;
    this._next = next;
    
    var codeLength = 7 + 2 * array.length;
    var buf = new Buffer(codeLength + 2); // add 2 crc bytes
    
    buf.writeUInt8(address, 0);
    buf.writeUInt8(code, 1);
    buf.writeUInt16BE(dataAddress, 2);
    buf.writeUInt16BE(array.length, 4);
    buf.writeUInt8(array.length * 2, 6);
    
    for (var i = 0; i < array.length; i++) {
        buf.writeUInt16BE(array[i], 7 + 2 * i);
    }
    
    // add crc bytes to buffer
    _CRC16(buf, codeLength);
    
    // write buffer to serial port
    this._port.write(buf);
}

module.exports = ModbusRTU;
module.exports.TcpPort = require('./tcpport');
