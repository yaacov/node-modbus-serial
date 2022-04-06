/* eslint-disable no-console */

const { bluetooth } = require("webbluetooth");
const ModbusRTU = require("../index");

async function run() {
    const client = new ModbusRTU();

    await client.connectBle({
        bluetooth,
        txService: "0000ffd0-0000-1000-8000-00805f9b34fb",
        txCharacteristic: "0000ffd1-0000-1000-8000-00805f9b34fb",
        rxService: "0000fff0-0000-1000-8000-00805f9b34fb",
        rxCharacteristic: "0000fff1-0000-1000-8000-00805f9b34fb"
    });

    // set the client's unit id
    client.setID(255);

    // set a timout for requests default is null (no timeout)
    client.setTimeout(1000);

    // read the 7 registers starting at address 256
    const data = await client.readHoldingRegisters(256, 7);
    console.log("Receive:", data.data);

    client.close();
}

run().catch((error) => console.error(error));
