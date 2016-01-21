'use strict';
var util = require('util');
var events = require('events');
var dgram = require('dgram');

var C701_PORT = 0x7002;

/**
 * calculate crc16
 *
 * @param {buffer} buf the buffer to to crc on.
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
 * check if a buffer chunk can be a modbus answer
 *
 * @param {buffer} buf the buffer to check.
 * @return {boolean} if the buffer can be an answer
 */
function checkData(modbus, buf) {
    // check buffer size
    if (buf.length != modbus._length) return false;
    
    // calculate crc16
    var crcIn = buf.readUInt16LE(buf.length - 2);

    // check buffer unit-id, command and crc
    return (buf[0] == modbus._id && 
        buf[1] == modbus._cmd &&
        crcIn == crc16(buf));
}

/**
 * Simulate a modbus-RTU port using C701 UDP-to-Serial bridge
 */
var UdpPort = function(ip, options) {
    var modbus = this;
    this.ip = ip;

    // options
    if (typeof(options) == 'undefined') options = {};
    this.port = options.port || C701_PORT; // C701 port

    // create a socket
    this._client = dgram.createSocket("udp4");

    // wait for answer
    this._client.on('message', function(data) {
        // check expected length
        if (modbus.length < 6) return;

        // check message length
        if (data.length < (116 + modbus.length)) return;

        // check the C701 packet magic
        if (data.readUInt16LE(2) != 602) return;

        // get the serial data from the C701 packet
        var buffer = data.slice(data.length - modbus._length);

        //check the serial data
        if (checkData(modbus, buffer)) {
            modbus.emit('data', buffer);
        }
    });

    events.call(this);
}
util.inherits(UdpPort, events);

/**
 * Simulate successful port open
 */
UdpPort.prototype.open = function (callback) {
    if (callback)
        callback(null);
}

/**
 * Simulate successful close port
 */
UdpPort.prototype.close = function (callback) {
    this._client.close();
    if (callback)
        callback(null);
}

/**
 * Send data to a modbus-tcp slave
 */
UdpPort.prototype.write = function (data) {
    // check data length
    if (data.length < 6) {
        // raise an error ?
        return;
    }

    // remember current unit and command
    this._id = data[0];
    this._cmd = data[1];

    // calculate expected answer length
    switch (this._cmd) {
        case 1:
        case 2:
            var length = data.readUInt16BE(4);
            this._length = 3 + parseInt((length - 1) / 8 + 1) + 2;
            break;
        case 3:
        case 4:
            var length = data.readUInt16BE(4);
            this._length = 3 + 2 * length + 2;
            break;
        case 5:
        case 6:
        case 16:
            this._length = 6 + 2;
            break;
        default:
            // raise and error ?
            this._length = 0;
            break;
    }

    // build C701 header
    var buffer = new Buffer(data.length + 116);
    buffer.fill(0);
    buffer.writeUInt16LE(600, 2);           // C701 magic for serial bridge
    buffer.writeUInt16LE(0, 36);            // C701 RS485 connector (0..2)
    buffer.writeUInt16LE(this._length, 38); // expected serial answer length
    buffer.writeUInt16LE(1, 102);           // C7011 RS481 hub (1..2)
    buffer.writeUInt16LE(data.length, 104); // serial data length

    // add serial line data
    data.copy(buffer, 116);

    // send buffer to C701 UDP to serial bridge
    this._client.send(buffer, 0, buffer.length, this.port, this.ip);
}

module.exports = UdpPort;
