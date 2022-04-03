/* globals navigator */

"use strict";

const { EventEmitter } = require("events");
const debug = require("debug")("modbus-serial");

/**
 * Bluetooth Low Energy port for Modbus.
 */
class BlePort extends EventEmitter {
    constructor(options) {
        super();

        if (typeof(options) === "undefined") options = {};

        this._bluetooth = options.bluetooth || navigator.bluetooth;
        this._txServiceUuid = options.txService;
        this._txCharacteristicUuid = options.txCharacteristic;
        this._rxServiceUuid = options.rxService;
        this._rxCharacteristicUuid = options.rxCharacteristic;

        this._boundHandleDisconnection = this._handleDisconnection.bind(this);
        this._boundHandleCharacteristicValueChanged = this._handleCharacteristicValueChanged.bind(this);
    }

    get isOpen() {
        return Boolean(this._device) && this._device.gatt.connected;
    }

    async open(callback) {
        let error;
        try {
            const options = {
                filters: [{ services: [this._txServiceUuid] }],
                optionalServices: [this._txServiceUuid, this._rxServiceUuid]
            };
            debug({ action: "requesting BLE device", options });
            this._device = await this._bluetooth.requestDevice(options);
            debug({ action: "BLE device connected", name: this._device.name, id: this._device.id });

            this._device.addEventListener("gattserverdisconnected", this._boundHandleDisconnection);

            debug({ action: "Connecting to GATT server" });
            this._server = await this._device.gatt.connect();
            debug({ action: "GATT server connected" });

            debug({ action: "Getting TX service", uuid: this._txServiceUuid });
            this._txService = await this._server.getPrimaryService(this._txServiceUuid);
            debug({ action: "TX service found" });

            debug({ action: "Getting TX characteristic", uuid: this._txCharacteristicUuid });
            this._txCharacteristic = await this._txService.getCharacteristic(this._txCharacteristicUuid);
            debug({ action: "TX characteristic found" });

            debug({ action: "Getting RX service", uuid: this._rxServiceUuid });
            this._rxService = await this._server.getPrimaryService(this._rxServiceUuid);
            debug({ action: "RX service found" });

            debug({ action: "Getting RX characteristic", uuid: this._rxCharacteristicUuid });
            this._rxCharacteristic = await this._rxService.getCharacteristic(this._rxCharacteristicUuid);
            debug({ action: "RX characteristic found" });

            debug({ action: "Starting RX notifications" });
            await this._rxCharacteristic.startNotifications();
            debug({ action: "RX notifications started" });

            this._rxCharacteristic.addEventListener("characteristicvaluechanged", this._boundHandleCharacteristicValueChanged);
        } catch (_error) {
            error = _error;
        }

        if (callback) {
            callback(error);
        }
    }

    async close(callback) {
        let error;
        try {
            if (this._rxCharacteristic) {
                debug({ action: "Stopping RX notifications" });
                await this._rxCharacteristic.stopNotifications();
                debug({ action: "RX notifications stopped" });

                this._rxCharacteristic.removeEventListener("characteristicvaluechanged", this._boundHandleCharacteristicValueChanged);
            }

            if (this._device) {
                debug({ action: "Disconnecting from GATT server" });

                this._device.removeEventListener("gattserverdisconnected", this._boundHandleDisconnection);

                if (this._device.gatt.connected) {
                    this._device.gatt.disconnect();
                    debug({ action: "GATT server disconnected" });
                } else {
                    debug({ action: "GATT server is already disconnected" });
                }
            }
        } catch (_error) {
            error = _error;
        }

        if (callback) {
            callback(error);
        }
    }

    /**
     * Writes raw data to the TX characteristic.
     * @param {Buffer} data
     * @returns {Promise}
     */
    async write(data) {
        debug({ action: "Writing to TX characteristic", data });
        await this._txCharacteristic.writeValue(BlePort._bufferToArrayBuffer(data));
    }

    _handleDisconnection() {
        debug({ action: "GATT server disconnected" });
        this.emit("close");
    }

    /**
     * Handles a received GATT value change event.
     * @param event
     * @private
     */
    _handleCharacteristicValueChanged(event) {
        const dataView = event.target.value;
        const buffer = Buffer.from(dataView.buffer, dataView.byteOffset, dataView.byteLength);
        debug({ action: "RX characteristic changed", buffer });
        this.emit("data", buffer);
    }

    /**
     * Converts a Node.js `Buffer` to an `ArrayBuffer`.
     * @param {Buffer} buffer
     * @returns {ArrayBuffer}
     * @private
     */
    static _bufferToArrayBuffer(buffer) {
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    }
}

module.exports = BlePort;
