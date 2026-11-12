"use strict";

const assert = require("assert");
const net = require("net");
const Modbus = require("../..");

const closeEvents = new WeakMap();

function closed(socket) {
    if (!closeEvents.has(socket)) {
        closeEvents.set(socket, new Promise(resolve => socket.once("close", resolve)));
    }
    return closeEvents.get(socket);
}

async function bounded(promise) {
    let timer;
    try {
        return await Promise.race([
            promise,
            new Promise((resolve, reject) => {
                timer = setTimeout(() => reject(new Error("close did not complete")), 250);
            })
        ]);
    } finally {
        clearTimeout(timer);
    }
}

for (const method of ["connectTCP", "connectTcpRTUBuffered", "connectTelnet"]) {
    describe(method + " close lifecycle", function() {
        let client;
        let server;
        let peer;

        beforeEach(function() {
            client = new Modbus();
            server = net.createServer(socket => { peer = socket; });
        });

        afterEach(async function() {
            if (client._port) client._port._client.destroy();
            if (peer) peer.destroy();
            if (server.listening) await new Promise(resolve => server.close(resolve));
            peer = null;
        });

        async function listen() {
            await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
            return server.address().port;
        }

        async function failConnect() {
            const port = await listen();
            await new Promise(resolve => server.close(resolve));
            const connecting = client[method]("127.0.0.1", { port });
            const socket = client._port._client;
            closed(socket);
            await assert.rejects(connecting, { code: "ECONNREFUSED" });
            assert.strictEqual(client.isOpen, false);
            return socket;
        }

        it("completes close after a failed connection has closed", async function() {
            const socket = await failConnect();
            await closed(socket);
            await bounded(client.close());
            assert.strictEqual(socket.closed, true);
        });

        it("waits for the socket close after a connection error", async function() {
            const port = await listen();
            await new Promise(resolve => server.close(resolve));
            const connecting = client[method]("127.0.0.1", { port });
            const socket = client._port._client;
            let sawClose = false;
            socket.once("close", () => { sawClose = true; });
            const closing = new Promise((resolve, reject) => {
                socket.once("error", function() {
                    client.close(function(error) {
                        if (error) reject(error);
                        else {
                            try {
                                assert.strictEqual(sawClose, true);
                                resolve();
                            } catch (failure) { reject(failure); }
                        }
                    });
                });
            });
            await assert.rejects(connecting, { code: "ECONNREFUSED" });
            await bounded(closing);
        });

        it("calls a failed-connection close callback exactly once", async function() {
            const socket = await failConnect();
            await closed(socket);
            let count = 0;
            await bounded(new Promise((resolve, reject) => client.close(function(error) {
                count++;
                if (error) reject(error);
                else resolve();
            })));
            await new Promise(resolve => setImmediate(resolve));
            assert.strictEqual(count, 1);
        });

        it("still closes an established connection", async function() {
            const port = await listen();
            await client[method]("127.0.0.1", { port });
            const socket = client._port._client;
            assert.strictEqual(client.isOpen, true);
            await bounded(client.close());
            assert.strictEqual(client.isOpen, false);
            assert.strictEqual(socket.closed, true);
        });

        it("completes another close after a successful close", async function() {
            const port = await listen();
            await client[method]("127.0.0.1", { port });
            await bounded(client.close());
            await bounded(client.close());
        });

        it("completes close after the peer disconnects", async function() {
            const port = await listen();
            await client[method]("127.0.0.1", { port });
            const socket = client._port._client;
            const disconnected = closed(socket);
            peer.end();
            await disconnected;
            await bounded(client.close());
        });

        it("can connect again after closing a failed connection", async function() {
            const socket = await failConnect();
            await closed(socket);
            await bounded(client.close());
            const port = await listen();
            await client[method]("127.0.0.1", { port });
            assert.strictEqual(client.isOpen, true);
            await bounded(client.close());
        });
    });
}
