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

for (const kind of ["tcpport", "tcprtubufferedport", "telnetport"]) {
    describe(kind + " reused socket close lifecycle", function() {
        for (const firstAttemptSucceeds of [false, true]) {
            it("waits for a failed reopen after " + (firstAttemptSucceeds ? "success" : "failure"), async function() {
                const Port = require("../../ports/" + kind);
                const peers = [];
                const server = net.createServer(socket => peers.push(socket));
                await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
                const adapter = new Port("127.0.0.1", { port: server.address().port });
                let closeCount = 0;
                adapter._client.on("close", () => { closeCount++; });
                try {
                    if (!firstAttemptSucceeds) await new Promise(resolve => server.close(resolve));
                    const firstClose = new Promise(resolve => adapter._client.once("close", resolve));
                    const opening = new Promise((resolve, reject) => adapter.open(error => error ? reject(error) : resolve()));
                    if (firstAttemptSucceeds) {
                        await opening;
                        await bounded(new Promise(resolve => adapter.close(resolve)));
                    } else {
                        await assert.rejects(opening, { code: "ECONNREFUSED" });
                    }
                    await firstClose;
                    if (firstAttemptSucceeds) await new Promise(resolve => server.close(resolve));

                    const secondClose = new Promise(resolve => adapter._client.once("close", resolve));
                    await bounded(new Promise((resolve, reject) => adapter.open(function(error) {
                        try {
                            assert.strictEqual(error.code, "ECONNREFUSED");
                        } catch (failure) { reject(failure); return; }
                        adapter.close(function(closeError) {
                            try {
                                assert.ifError(closeError);
                                assert.strictEqual(closeCount, 2);
                                resolve();
                            } catch (failure) { reject(failure); }
                        });
                    })));
                    await secondClose;
                } finally {
                    adapter._client.destroy();
                    peers.forEach(peer => peer.destroy());
                    if (server.listening) await new Promise(resolve => server.close(resolve));
                }
            });
        }
    });
}

describe("Telnet closed-session listeners", function() {
    for (const withCallback of [false, true]) {
        it("cleans up listeners before reopening " + (withCallback ? "with" : "without") + " a close callback", async function() {
            const Port = require("../../ports/telnetport");
            const peers = [];
            const server = net.createServer(function(peer) {
                peers.push(peer);
                let request = Buffer.alloc(0);
                peer.on("data", function(data) {
                    request = Buffer.concat([request, data]);
                    if (request.length < 8) return;
                    assert.strictEqual(request.toString("hex"), "110300170001369e");
                    peer.write(Buffer.from("110302123474f0", "hex"));
                });
            });
            await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
            const adapter = new Port("127.0.0.1", { port: server.address().port });
            let oldDeliveries = 0;
            let callbacks = 0;
            try {
                await new Promise((resolve, reject) => adapter.open(error => error ? reject(error) : resolve()));
                adapter.on("data", () => { oldDeliveries++; });
                adapter.on("close", () => {});
                const peerClosed = new Promise(resolve => adapter._client.once("close", resolve));
                peers[0].end();
                await peerClosed;
                if (withCallback) adapter.close(() => { callbacks++; });
                else adapter.close();
                await new Promise(resolve => setImmediate(resolve));
                const retainedData = adapter.listenerCount("data");
                const retainedClose = adapter.listenerCount("close");

                await new Promise((resolve, reject) => adapter.open(error => error ? reject(error) : resolve()));
                const received = new Promise(resolve => adapter.once("data", resolve));
                adapter.write(Buffer.from("110300170001369e", "hex"));
                assert.strictEqual((await bounded(received)).toString("hex"), "110302123474f0");
                assert.strictEqual(oldDeliveries, 0);
                assert.strictEqual(retainedData, 0);
                assert.strictEqual(retainedClose, 0);
                assert.strictEqual(callbacks, withCallback ? 1 : 0);
                await bounded(new Promise(resolve => adapter.close(resolve)));
            } finally {
                adapter._client.destroy();
                peers.forEach(peer => peer.destroy());
                await new Promise(resolve => server.close(resolve));
            }
        });
    }
});
