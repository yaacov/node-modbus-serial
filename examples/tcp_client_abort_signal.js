"use strict";

// create an empty modbus client
// let ModbusRTU = require("modbus-serial");
const ModbusRTU = require("../index");
const client = new ModbusRTU();

const abortController = new AbortController();
const { signal } = abortController;
signal.addEventListener("abort", () => {
    console.log("Abort signal received by the abort controller");
});

async function connect() {
    await client.connectTCP("127.0.0.1", {
        port: 8502,
        socketOpts: {
            signal: signal
        }
    });
    client.setID(1);
    client.setTimeout(2000);
}

async function readRegisters() {
    const data = await client.readHoldingRegisters(5, 4);
    console.log("Received:", data.data);
}

async function runner() {
    await connect();

    setTimeout(() => {
        abortController.abort("Aborting request");
    }, 1000);

    await readRegisters();
}

runner()
    .then(() => {
        if (signal.aborted) {
            if (signal.reason) {
                console.log(`Request aborted with reason: ${signal.reason}`);
            } else {
                console.log("Request aborted but no reason was given.");
            }
        } else {
            console.log("Request not aborted");
        }
    })
    .catch((error) => {
        console.error(error);
    })
    .finally(async() => {
        console.log("Close client");
        await client.close();
    });
