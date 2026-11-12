"use strict";

const assert = require("assert");
const net = require("net");
const TcpServer = require("../../servers/servertcp");

const modes = [
    { name: "holding registers", method: "getMultipleHoldingRegisters", fc: 3, size: 2 },
    { name: "input registers", method: "getMultipleInputRegisters", fc: 4, size: 2 },
    { name: "Enron holding registers", method: "getMultipleHoldingRegisters", fc: 3, size: 4, enron: true }
];

for (const mode of modes) {
    describe("Modbus TCP batch " + mode.name, function() {
        let server;
        let client;
        const address = mode.enron ? 5001 : 10;
        const values = mode.enron ? [0x12345678, 0x90abcdef] : [0x1234, 0xabcd];
        const calls = [];
        const providers = {
            "an array": () => values,
            "an array of Promises": () => values.map(value => Promise.resolve(value)),
            "a Promise of an array": () => Promise.resolve(values),
            "an asynchronously resolved array": () => new Promise(resolve => setImmediate(() => resolve(values))),
            "a rejected Promise": () => Promise.reject(Object.assign(new Error("Read failed"), { modbusErrorCode: 2 })),
            "a Promise with the wrong array length": () => Promise.resolve(values.slice(0, 1)),
            "a synchronous error": () => { throw new Error("Read failed"); }
        };

        afterEach(function(done) {
            if (client) client.destroy();
            if (server) server.close(done);
            else done();
        });

        for (const provider of [...Object.keys(providers), "a callback", "individual register Promises", "individual register callbacks"]) {
            it("reads from " + provider, function(done) {
                calls.length = 0;
                const vector = {};
                if (provider === "individual register Promises") {
                    const method = mode.fc === 4 ? "getInputRegister" : "getHoldingRegister";
                    vector[method] = function(addr, unitID) {
                        calls.push([addr, unitID]);
                        return Promise.resolve(values[addr - address]);
                    };
                } else if (provider === "individual register callbacks") {
                    const method = mode.fc === 4 ? "getInputRegister" : "getHoldingRegister";
                    vector[method] = function(addr, unitID, callback) {
                        calls.push([addr, unitID]);
                        setImmediate(() => callback(null, values[addr - address]));
                    };
                } else if (provider === "a callback") {
                    vector[mode.method] = function(addr, length, unitID, callback) {
                        calls.push([addr, length, unitID]);
                        setImmediate(() => callback(null, values));
                    };
                } else {
                    vector[mode.method] = function(addr, length, unitID) {
                        calls.push([addr, length, unitID]);
                        return providers[provider]();
                    };
                }
                server = new TcpServer(vector, {
                    host: "127.0.0.1", port: 8519, unitID: 17,
                    enron: mode.enron,
                    enronTables: { shortRange: [3001, 3999], longRange: [5001, 5999], floatRange: [7001, 7999] }
                });
                server.once("serverError", done);
                server.once("initialized", function() {
                    client = net.connect({ host: "127.0.0.1", port: 8519 }, function() {
                        const request = Buffer.from("123400000006110300000002", "hex");
                        request[7] = mode.fc;
                        request.writeUInt16BE(address, 8);
                        client.write(request);
                    });
                    client.once("error", done);
                    let received = Buffer.alloc(0);
                    client.on("data", function(data) {
                        received = Buffer.concat([received, data]);
                        if (received.length < 6 || received.length < 6 + received.readUInt16BE(4)) return;
                        try {
                            const expectedCalls = provider.startsWith("individual")
                                ? [[address, 17], [address + 1, 17]] : [[address, 2, 17]];
                            assert.deepStrictEqual(calls, expectedCalls);
                            const errorCode = provider === "a rejected Promise" ? 2 : 4;
                            if (/rejected|wrong array length|synchronous error/.test(provider)) {
                                const expected = Buffer.from("123400000003118304", "hex");
                                expected[7] = mode.fc | 0x80;
                                expected[8] = errorCode;
                                assert.deepStrictEqual(received, expected);
                            } else {
                                const expected = Buffer.alloc(9 + 2 * mode.size);
                                expected.writeUInt16BE(0x1234, 0);
                                expected.writeUInt16BE(expected.length - 6, 4);
                                expected[6] = 17;
                                expected[7] = mode.fc;
                                expected[8] = 2 * mode.size;
                                values.forEach((value, index) => {
                                    if (mode.size === 4) expected.writeUInt32BE(value, 9 + index * 4);
                                    else expected.writeUInt16BE(value, 9 + index * 2);
                                });
                                assert.deepStrictEqual(received, expected);
                            }
                            client.removeAllListeners("data");
                            done();
                        } catch (error) {
                            client.removeAllListeners("data");
                            done(error);
                        }
                    });
                });
            });
        }
    });
}
