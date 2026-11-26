"use strict";

const assert = require("node:assert/strict");
const net = require("node:net");
const { once } = require("node:events");
const TcpServer = require("../../servers/servertcp");

// Accumulate a complete MBAP frame even if TCP splits the response.
function exchange(socket, request) {
    return new Promise((resolve, reject) => {
        let received = Buffer.alloc(0);
        const timer = setTimeout(() => finish(new Error("No Modbus response")), 500);
        function finish(error, response) {
            clearTimeout(timer);
            socket.removeListener("data", onData);
            socket.removeListener("error", onError);
            if (error) reject(error);
            else resolve(response);
        }
        function onError(error) { finish(error); }
        function onData(chunk) {
            received = Buffer.concat([received, chunk]);
            if (received.length >= 6 && received.length >= 6 + received.readUInt16BE(4)) {
                finish(null, received);
            }
        }
        socket.on("data", onData);
        socket.once("error", onError);
        socket.write(Buffer.from(request, "hex"));
    });
}

describe("Unconfigured bit reads", function() {
    for (const [fc, name, other] of [[1, "getCoil", "getDiscreteInput"], [2, "getDiscreteInput", "getCoil"]]) {
        it(`returns illegal function for missing ${name} and keeps the connection usable`, async function() {
            const vector = { [other]: () => true };
            // String zero requests an ephemeral port without the constructor's numeric-zero fallback.
            const server = new TcpServer(vector, { host: "127.0.0.1", port: "0", unitID: 1 });
            let socket;
            try {
                await Promise.race([
                    once(server, "initialized"),
                    once(server, "serverError").then(([error]) => { throw error; })
                ]);
                socket = net.connect(server._server.address().port, "127.0.0.1");
                await once(socket, "connect");
                const response = await exchange(socket, `000100000006010${fc}00000001`);
                assert.equal(response.toString("hex"), `000100000003018${fc}01`);
                const supported = fc === 1 ? 2 : 1;
                const control = await exchange(socket, `000200000006010${supported}00000001`);
                assert.equal(control.toString("hex"), `000200000004010${supported}0101`);
            } finally {
                if (socket) socket.destroy();
                await new Promise(resolve => server.close(resolve));
            }
        });
    }
});
