"use strict";
/**
 * Shared Modbus ASCII framing helpers, used by the serial (AsciiPort)
 * and TCP (AsciiTcpPort) ASCII transports.
 */
const modbusSerialDebug = require("debug")("modbus-serial");

const crc16 = require("./crc16");
const calculateLrc = require("./lrc");

/**
 * Ascii encode a 'request' buffer and return it. This includes removing
 * the CRC bytes and replacing them with an LRC.
 *
 * @param {Buffer} buf the data buffer to encode.
 * @return {Buffer} the ascii encoded buffer
 */
function encodeRequestBuffer(buf) {

    // replace the 2 byte crc16 with a single byte lrc
    buf.writeUInt8(calculateLrc(buf.slice(0, -2)), buf.length - 2);

    // create a new buffer of the correct size
    const bufAscii = Buffer.alloc(buf.length * 2 + 1); // 1 byte start delimit + x2 data as ascii encoded + 2 lrc + 2 end delimit

    // create the ascii payload

    // start with the single start delimiter
    bufAscii.write(":", 0);
    // encode the data, with the new single byte lrc
    bufAscii.write(buf.toString("hex", 0, buf.length - 1).toUpperCase(), 1);
    // end with the two end delimiters
    bufAscii.write("\r", bufAscii.length - 2);
    bufAscii.write("\n", bufAscii.length - 1);

    return bufAscii;
}

/**
 * Ascii decode a 'response' buffer and return it.
 *
 * @param {Buffer} bufAscii the ascii data buffer to decode.
 * @return {Buffer} the decoded buffer, or null if decode error
 */
function decodeResponseBuffer(bufAscii) {

    // create a new buffer of the correct size (based on ascii encoded buffer length)
    const bufDecoded = Buffer.alloc((bufAscii.length - 1) / 2);

    // decode into new buffer (removing delimiters at start and end)
    for (let i = 0; i < (bufAscii.length - 3) / 2; i++) {
        bufDecoded.write(String.fromCharCode(bufAscii.readUInt8(i * 2 + 1), bufAscii.readUInt8(i * 2 + 2)), i, 1, "hex");
    }

    // check the lrc is true
    const lrcIn = bufDecoded.readUInt8(bufDecoded.length - 2);
    if(calculateLrc(bufDecoded.slice(0, -2)) !== lrcIn) {
        // return null if lrc error
        const calcLrc = calculateLrc(bufDecoded.slice(0, -2));

        modbusSerialDebug({ action: "LRC error", LRC: lrcIn.toString(16), calcLRC: calcLrc.toString(16) });
        return null;
    }

    // replace the 1 byte lrc with a two byte crc16
    bufDecoded.writeUInt16LE(crc16(bufDecoded.slice(0, -2)), bufDecoded.length - 2);

    return bufDecoded;
}

/**
 * check if a buffer chunk can be a modbus answer
 * or modbus exception
 *
 * @param {Object} modbus the port holding the expected _id, _cmd and _length
 * @param {Buffer} buf the buffer to check.
 * @return {boolean} if the buffer can be an answer
 */
function checkData(modbus, buf) {
    // check buffer size
    if (buf.length !== modbus._length && buf.length !== 5) {
        modbusSerialDebug({ action: "length error", receive: buf.length, expected: modbus._length });

        return false;
    }

    // check buffer unit-id and command
    return (buf[0] === modbus._id &&
        (0x7f & buf[1]) === modbus._cmd);
}

/**
 * Calculate the expected (decoded) answer length for a request.
 *
 * @param {Buffer} data the RTU request buffer (with crc).
 * @return {number} the expected answer length, or 0 if unknown
 */
function expectedResponseLength(data) {
    let length;

    switch (data[1]) {
        case 1:
        case 2:
            length = data.readUInt16BE(4);
            return 3 + parseInt((length - 1) / 8 + 1) + 2;
        case 3:
        case 4:
            length = data.readUInt16BE(4);
            return 3 + 2 * length + 2;
        case 5:
        case 6:
        case 15:
        case 16:
            return 6 + 2;
        default:
            // raise and error ?
            modbusSerialDebug({ action: "unknown command", id: data[0].toString(16), command: data[1].toString(16) });
            return 0;
    }
}

/**
 * Handle incoming ascii data: append it to the port's internal buffer and,
 * once a complete frame is buffered, decode it and emit "data" if it is the
 * answer the port is waiting for.
 *
 * @param {Object} modbus the port (an EventEmitter with _buffer, _id, _cmd, _length
 *   and _startOfSlaveFrameChar)
 * @param {Buffer} data the received data chunk
 */
function handleData(modbus, data) {

    // add new data to buffer
    modbus._buffer = Buffer.concat([modbus._buffer, data]);

    modbusSerialDebug({ action: "receive ascii port", data: data, buffer: modbus._buffer });
    modbusSerialDebug(JSON.stringify({ action: "receive ascii port strings", data: data, buffer: modbus._buffer }));

    // check buffer for start delimiter
    const sdIndex = modbus._buffer.indexOf(modbus._startOfSlaveFrameChar);
    if(sdIndex === -1) {
        // if not there, reset the buffer and return
        modbus._buffer = Buffer.from("");
        return;
    }
    // if there is data before the start delimiter, remove it
    if(sdIndex > 0) {
        modbus._buffer = modbus._buffer.slice(sdIndex);
    }
    // do we have the complete message (i.e. are the end delimiters there)
    if(modbus._buffer.includes("\r\n", 1, "ascii") === true) {
        // check there is no excess data after end delimiters
        const edIndex = modbus._buffer.indexOf(0x0A); // ascii for '\n'
        if(edIndex !== modbus._buffer.length - 1) {
            // if there is, remove it
            modbus._buffer = modbus._buffer.slice(0, edIndex + 1);
        }

        // we have what looks like a complete ascii encoded response message, so decode
        const _data = decodeResponseBuffer(modbus._buffer);
        modbusSerialDebug({ action: "got EOM", data: _data, buffer: modbus._buffer });
        if(_data !== null) {

            // check if this is the data we are waiting for
            if (checkData(modbus, _data)) {
                modbusSerialDebug({ action: "emit data ascii port", data: data, buffer: modbus._buffer });
                modbusSerialDebug(JSON.stringify({ action: "emit data ascii port strings", data: data, buffer: modbus._buffer }));
                // emit a data signal
                modbus.emit("data", _data);
            }
        }
        // reset the buffer now its been used
        modbus._buffer = Buffer.from("");
    } else {
        // otherwise just wait for more data to arrive
    }
}

module.exports = {
    encodeRequestBuffer,
    decodeResponseBuffer,
    checkData,
    expectedResponseLength,
    handleData
};