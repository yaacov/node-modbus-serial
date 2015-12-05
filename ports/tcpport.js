'use strict';
var util = require('util');
var events = require('events');
var net = require('net');

var MODBUS_PORT = 502; // modbus port

/**
 * calculate crc16
 *
 * @param {buffer} buf the buffer to to crc on.
 *
 * @return {number} the calculated crc16
 */
function crc16(buf) {
    var length = buf.length - 2;
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
    
    return crc;
}

/**
 * Simulate a modbus-RTU port using modbus-TCP connection
 */
var TcpPort = function(ip, port) {
    var _tcpport = this;
    this.ip = ip;
    this.port = port || MODBUS_PORT; // modbus port
    
    // create a socket
    this._client = new net.Socket();
    this._client.on('data', function(data) {
        var buffer;
        var crc;
        
        // check data length
        if (data.length < 6) return;
        
        // cut 6 bytes of mbap, copy pdu and add crc
        buffer = new Buffer(data.length - 6 + 2);
        data.copy(buffer, 0, 6);
        crc = crc16(buffer);
        buffer.writeUInt16LE(crc, buffer.length - 2);
        
        // emit a data signal
        _tcpport.emit('data', buffer);
    });

    events.call(this);
}
util.inherits(TcpPort, events);

/**
 * Simulate successful port open
 */
TcpPort.prototype.open = function (callback) {
    this._client.connect(this.port, this.ip, callback);
}

/**
 * Simulate successful close port
 */
TcpPort.prototype.close = function (callback) {
    this._client.end();
    if (callback)
        callback(null);
}

/**
 * Send data to a modbus-tcp slave
 */
TcpPort.prototype.write = function (data) {
    // remove crc and add mbap
    var buffer = new Buffer(data.length + 6 - 2);
    buffer.writeUInt16BE(1, 0);
    buffer.writeUInt16BE(0, 2);
    buffer.writeUInt16BE(data.length - 2, 4);
    data.copy(buffer, 6);
    
    // send buffer to slave
    this._client.write(buffer);
}

module.exports = TcpPort;
