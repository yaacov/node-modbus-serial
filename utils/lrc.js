"use strict";
/**
 * Calculates the buffers LRC.
 *
 * @param {Buffer} buffer the data buffer.
 * @return {number} the calculated LRC.
 */
module.exports = function lrc(buffer) {
    var lrc = 0;
    for (var i = 0; i < buffer.length; i++) {
        lrc += buffer[i] & 0xFF;
    }

    return ((lrc ^ 0xFF) + 1) & 0xFF;
};
