"use strict";
/**
 * Lengths of RTU responses whose size only their content tells: Report Server ID (FC 17) and
 * Read Device Identification (FC 43 / MEI 0x0E). Shared by the buffered RTU port and the Telnet port.
 */

// largest Modbus RTU frame (ADU); a candidate claiming more is no response
const MAX_RTU_FRAME_LENGTH = 256;
const CRC_LENGTH = 2;
// unit id, function code, byte count
const REPORT_SERVER_ID_HEADER_LENGTH = 3;
// unit id, function code, MEI type, read device id code, conformity level, more follows, next object id,
// number of objects
const READ_DEVICE_IDENTIFICATION_HEADER_LENGTH = 8;
const NUMBER_OF_OBJECTS_OFFSET = 7;
// object id and object length precede every object value
const OBJECT_HEADER_LENGTH = 2;

/**
 * Length of a Report Server ID (FC 17) response.
 *
 * @param {Buffer} buffer received bytes
 * @param {number} start offset of the response's unit id within the buffer
 * @returns {number|null} length of the whole response including the CRC, null while its byte count is missing;
 *          above MAX_RTU_FRAME_LENGTH the bytes are no response
 */
const reportServerIdLength = function(buffer, start) {
    if (buffer.length < start + REPORT_SERVER_ID_HEADER_LENGTH) {
        return null;
    }
    return REPORT_SERVER_ID_HEADER_LENGTH + buffer[start + 2] + CRC_LENGTH;
};

/**
 * Length of a Read Device Identification (FC 43 / MEI 0x0E) response: the header, then per object its id,
 * its length and its value.
 *
 * @param {Buffer} buffer received bytes
 * @param {number} start offset of the response's unit id within the buffer
 * @returns {number|null} length of the whole response including the CRC, null while the object list is incomplete;
 *          above MAX_RTU_FRAME_LENGTH the bytes are no response, reported as soon as the objects tell
 */
const readDeviceIdentificationLength = function(buffer, start) {
    if (buffer.length < start + READ_DEVICE_IDENTIFICATION_HEADER_LENGTH) {
        return null;
    }
    const numObjects = buffer[start + NUMBER_OF_OBJECTS_OFFSET];
    let offset = start + READ_DEVICE_IDENTIFICATION_HEADER_LENGTH;
    for (let i = 0; i < numObjects; i++) {
        if (buffer.length < offset + OBJECT_HEADER_LENGTH) {
            return null;
        }
        offset += OBJECT_HEADER_LENGTH + buffer[offset + 1];
        // waiting for the remaining objects would block the responses behind this candidate
        if (offset - start + CRC_LENGTH > MAX_RTU_FRAME_LENGTH) {
            return offset - start + CRC_LENGTH;
        }
    }
    return offset - start + CRC_LENGTH;
};

module.exports = {
    MAX_RTU_FRAME_LENGTH,
    reportServerIdLength,
    readDeviceIdentificationLength
};
