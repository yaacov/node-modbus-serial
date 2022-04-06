/* eslint-disable class-methods-use-this */
"use strict";
const events = require("events");
const EventEmitter = events.EventEmitter || events;
const modbusSerialDebug = require("debug")("modbus-serial");

/* Add bit operation functions to Buffer
 */
require("../utils/buffer_bit")();
const crc16 = require("../utils/crc16");

const MIN_DATA_LENGTH = 7;

class TestPort extends EventEmitter {
    /**
     * Simulate a serial port with 4 modbus-rtu slaves connected.
     *
     * 1 - a modbus slave working correctly
     * 2 - a modbus slave that answer short replays
     * 3 - a modbus slave that answer with bad crc
     * 4 - a modbus slave that answer with bad unit number
     * 5 - a modbus slave that answer with an exception
     * 6 - a modbus slave that times out (does not answer)
     */
    constructor() {
        super();

        // simulate 11 input registers
        this._registers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

        // simulate 11 holding registers
        this._holding_registers = [0, 0, 0, 0, 0, 0, 0, 0, 0xa12b, 0xffff, 0xb21a];

        // simulate 16 coils / digital inputs
        this._coils = 0x0000; // TODO 0xa12b, 1010 0001 0010 1011
    }

    /**
     * Check if port is open.
     *
     * @returns {boolean}
     */
    get isOpen() {
        return true;
    }

    /**
     * Simulate successful port open.
     *
     * @param callback
     */
    open(callback) {
        if (callback)
            callback(null);
    }

    /**
     * Simulate successful close port.
     *
     * @param callback
     */
    close(callback) {
        if (callback)
            callback(null);
    }

    /**
     * Simulate successful/failure port requests and replays.
     *
     * @param {Buffer} data
     */
    write(data) {
        let buffer = null;
        let length = null;
        let address = null;
        let value = null;
        let state = null;
        let i = null;

        if(data.length < MIN_DATA_LENGTH) {
            modbusSerialDebug("expected length of data is to small - minimum is " + MIN_DATA_LENGTH);
            return;
        }

        const unitNumber = data[0];
        const functionCode = data[1];
        let crc = data[data.length - 2] + data[data.length - 1] * 0x100;
        // if crc is bad, ignore message
        if (crc !== crc16(data.slice(0, -2))) {
            return;
        }

        // function code 1 and 2
        if (functionCode === 1 || functionCode === 2) {
            address = data.readUInt16BE(2);
            length = data.readUInt16BE(4);

            // if length is bad, ignore message
            if (data.length !== 8) {
                return;
            }

            // build answer
            buffer = Buffer.alloc(3 + parseInt((length - 1) / 8 + 1) + 2);
            buffer.writeUInt8(parseInt((length - 1) / 8 + 1), 2);

            // read coils
            buffer.writeUInt16LE(this._coils >> address, 3);
        }

        // function code 3
        if (functionCode === 3) {
            address = data.readUInt16BE(2);
            length = data.readUInt16BE(4);

            // if length is bad, ignore message
            if (data.length !== 8) {
                return;
            }

            // build answer
            buffer = Buffer.alloc(3 + length * 2 + 2);
            buffer.writeUInt8(length * 2, 2);

            // read registers
            for (i = 0; i < length; i++) {
                buffer.writeUInt16BE(this._holding_registers[address + i], 3 + i * 2);
            }
        }

        // function code 4
        if (functionCode === 4) {
            address = data.readUInt16BE(2);
            length = data.readUInt16BE(4);

            // if length is bad, ignore message
            if (data.length !== 8) {
                return;
            }

            // build answer
            buffer = Buffer.alloc(3 + length * 2 + 2);
            buffer.writeUInt8(length * 2, 2);

            // read registers
            for (i = 0; i < length; i++) {
                buffer.writeUInt16BE(this._registers[address + i], 3 + i * 2);
            }
        }

        // function code 5
        if (functionCode === 5) {
            address = data.readUInt16BE(2);
            state = data.readUInt16BE(4);

            // if length is bad, ignore message
            if (data.length !== 8) {
                return;
            }

            // build answer
            buffer = Buffer.alloc(8);
            buffer.writeUInt16BE(address, 2);
            buffer.writeUInt16BE(state, 4);

            // write coil
            if (state === 0xff00) {
                this._coils |= (1 << address);
            } else {
                this._coils &= ~(1 << address);
            }
        }

        // function code 6
        if (functionCode === 6) {
            address = data.readUInt16BE(2);
            value = data.readUInt16BE(4);
            // if length is bad, ignore message
            if (data.length !== (6 + 2)) {
                return;
            }

            // build answer
            buffer = Buffer.alloc(8);
            buffer.writeUInt16BE(address, 2);
            buffer.writeUInt16BE(value, 4);

            this._holding_registers[address] = value;
        }

        // function code 15
        if (functionCode === 15) {
            address = data.readUInt16BE(2);
            length = data.readUInt16BE(4);

            // if length is bad, ignore message
            if (data.length !== 7 + Math.ceil(length / 8) + 2) {
                return;
            }

            // build answer
            buffer = Buffer.alloc(8);
            buffer.writeUInt16BE(address, 2);
            buffer.writeUInt16BE(length, 4);

            // write coils
            for (i = 0; i < length; i++) {
                state = data.readBit(i, 7);

                if (state) {
                    this._coils |= (1 << (address + i));
                } else {
                    this._coils &= ~(1 << (address + i));
                }
            }
        }

        // function code 16
        if (functionCode === 16) {
            address = data.readUInt16BE(2);
            length = data.readUInt16BE(4);

            // if length is bad, ignore message
            if (data.length !== (7 + length * 2 + 2)) {
                return;
            }

            // build answer
            buffer = Buffer.alloc(8);
            buffer.writeUInt16BE(address, 2);
            buffer.writeUInt16BE(length, 4);

            // write registers
            for (i = 0; i < length; i++) {
                this._holding_registers[address + i] = data.readUInt16BE(7 + i * 2);
            }
        }

        if (functionCode === 43) {
            const productCode = "MyProductCode1234";
            buffer = Buffer.alloc(12 + productCode.length);
            buffer.writeUInt8(16, 2); // MEI Type
            buffer.writeUInt8(data.readInt8(3), 3); // read device ID code
            buffer.writeUInt8(0x01, 4); // conformity level
            buffer.writeUInt8(0, 5); // number of follows left
            buffer.writeUInt8(0, 6); // next object ID
            buffer.writeUInt8(1, 7); // number of objects
            buffer.writeUInt8(data.readInt8(4), 8);
            buffer.writeUInt8(productCode.length, 9);
            buffer.write(productCode, 10, productCode.length, "ascii");
        }

        // send data back
        if (buffer) {
            // add unit number and function code
            buffer.writeUInt8(unitNumber, 0);
            buffer.writeUInt8(functionCode, 1);

            // corrupt the answer
            switch (unitNumber) {
                case 1:
                    // unit 1: answers correctly
                    break;
                case 2:
                    // unit 2: answers short data
                    buffer = buffer.slice(0, buffer.length - 5);
                    break;
                case 4:
                    // unit 4: answers with bad unit number
                    buffer[0] = unitNumber + 2;
                    break;
                case 5:
                    // unit 5: answers with exception
                    buffer.writeUInt8(functionCode + 128, 1);
                    buffer.writeUInt8(4, 2);
                    buffer = buffer.slice(0, 5);
                    break;
                case 6:
                    // unit 6: does not answer
                    return;
            }

            // add crc
            crc = crc16(buffer.slice(0, -2));
            buffer.writeUInt16LE(crc, buffer.length - 2);

            // unit 3: answers with bad crc
            if (unitNumber === 3) {
                buffer.writeUInt16LE(crc + 1, buffer.length - 2);
            }

            this.emit("data", buffer);

            modbusSerialDebug({
                action: "send test port",
                data: data,
                buffer: buffer,
                unitid: unitNumber,
                functionCode: functionCode
            });

            modbusSerialDebug(JSON.stringify({
                action: "send test port strings",
                data: data,
                buffer: buffer,
                unitid: unitNumber,
                functionCode: functionCode
            }));
        }
    }
}

/**
 * Test port for Modbus.
 *
 * @type {TestPort}
 */
module.exports = TestPort;
