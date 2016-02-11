'use strict';
/**
 * Calculates the buffers CRC16.
 *
 * @param {Buffer} buffer the data buffer.
 * @return {number} the calculated CRC16.
 */
module.exports = function (buffer) {
    var crc = 0xFFFF;
    var tmp;

    for (var i = 0; i < buffer.length; i++) {
        crc = crc ^ buffer[i];

        for (var j = 0; j < 8; j++) {
            tmp = crc & 0x0001;
            crc = crc >> 1;
            if (tmp) {
                crc = crc ^ 0xA001;
            }
        }
    }

    return crc;
};
