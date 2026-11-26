"use strict";
const assert = require("node:assert/strict");
const net = require("node:net");
const ModbusRTU = require("../../index");

describe("TCP RTU buffered maximum register responses", function() {
    for (const count of [123, 124, 125]) {
        for (const fragmented of [false, true]) {
            it(`reads ${count} input registers (${fragmented ? "fragmented" : "whole"} response)`, async function() {
                const server = net.createServer(socket => {
                    socket.once("data", request => {
                        const response = Buffer.alloc(9 + 2 * count);
                        request.copy(response, 0, 0, 4);
                        response.writeUInt16BE(3 + 2 * count, 4);
                        response[6] = request[6];
                        response[7] = request[7];
                        response[8] = 2 * count;
                        for (let i = 0; i < count; i++) response.writeUInt16BE(1000 + i, 9 + 2 * i);
                        if (fragmented) {
                            socket.write(response.subarray(0, 200));
                            setImmediate(() => socket.write(response.subarray(200)));
                        } else {
                            socket.write(response);
                        }
                    });
                });
                const client = new ModbusRTU();
                await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
                try {
                    await client.connectTcpRTUBuffered("127.0.0.1", { port: server.address().port });
                    client.setID(1);
                    client.setTimeout(500);
                    const result = await client.readInputRegisters(1, count);
                    assert.deepEqual(result.data, Array.from({ length: count }, (_, i) => 1000 + i));
                } finally {
                    if (client.isOpen) await new Promise(resolve => client.close(resolve));
                    await new Promise(resolve => server.close(resolve));
                }
            });
        }
    }
});
