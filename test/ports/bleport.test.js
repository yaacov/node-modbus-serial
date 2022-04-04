"use strict";
/* eslint-disable no-undef */

const expect = require("chai").expect;
const BlePort = require("./../../ports/bleport");
const { DeviceMock, WebBluetoothMock } = require("web-bluetooth-mock");

const TX_SERVICE_UUID = "0000ffd0-0000-1000-8000-00805f9b34fb";
const TX_CHARACTERISTIC_UUID = "0000ffd1-0000-1000-8000-00805f9b34fb";
const RX_SERVICE_UUID = "0000fff0-0000-1000-8000-00805f9b34fb";
const RX_CHARACTERISTIC_UUID = "0000fff1-0000-1000-8000-00805f9b34fb";

describe("Bluetooth LE port", function() {
    function prepare() {
        const deviceMock = new DeviceMock("Test Device", [TX_SERVICE_UUID, RX_SERVICE_UUID]);
        const txServiceMock = deviceMock.getServiceMock(TX_SERVICE_UUID);
        const txCharacteristicMock = txServiceMock.getCharacteristicMock(TX_CHARACTERISTIC_UUID);
        const rxServiceMock = deviceMock.getServiceMock(RX_SERVICE_UUID);
        const rxCharacteristicMock = txServiceMock.getCharacteristicMock(RX_CHARACTERISTIC_UUID);

        const bluetooth = new WebBluetoothMock([deviceMock]);

        const port = new BlePort({
            bluetooth,
            txService: TX_SERVICE_UUID,
            txCharacteristic: TX_CHARACTERISTIC_UUID,
            rxService: RX_SERVICE_UUID,
            rxCharacteristic: RX_CHARACTERISTIC_UUID
        });
        return { bluetooth, deviceMock, port, rxCharacteristicMock, rxServiceMock, txCharacteristicMock, txServiceMock };
    }

    describe("#isOpen", function() {
        it("should not be open before #open", function() {
            const { port } = prepare();
            expect(port.isOpen).to.be.false;
        });

        it("should be open after #open", function(done) {
            const { port } = prepare();
            port.open(function(error) {
                expect(error).to.be.undefined;
                expect(port.isOpen).to.be.true;
                done();
            });
        });

        it("should not be open after #close", function(done) {
            const { port } = prepare();
            port.open(function(error) {
                expect(error).to.be.undefined;

                port.close(function(error) {
                    expect(error).to.be.undefined;
                    expect(port.isOpen).to.be.false;
                    done();
                });
            });
        });
    });

    describe("data handler", function() {
        it("should return a valid Modbus RTU message", function(done) {
            const { port } = prepare();

            port.once("data", function(data) {
                expect(data.toString("hex")).to.equal("110306ae415652434049ad");
                done();
            });


            port.open(function(error) {
                expect(error).to.be.undefined;

                port.write(Buffer.from("1103006B00037687", "hex"));

                setTimeout(function() {
                    const buffer = Buffer.from("110306ae415652434049ad", "hex");
                    port._handleCharacteristicValueChanged(bufferToEvent(buffer));
                });
            });
        });
    });

    describe("#write", function() {
        it("should write a valid RTU message to the port", function(done) {
            const { port, txCharacteristicMock } = prepare();

            txCharacteristicMock.writeValue = (buffer) => {
                expect(Buffer.from(buffer).toString("hex")).to.equal("1103006b00037687");
                done();
            };

            port.open(function(error) {
                expect(error).to.be.undefined;

                port.write(Buffer.from("1103006B00037687", "hex"));
            });
        });
    });
});

function bufferToEvent(buffer) {
    const arrayBuffer = BlePort._bufferToArrayBuffer(buffer);
    const dataView = new DataView(arrayBuffer);
    return { target: { value: dataView } };
}
