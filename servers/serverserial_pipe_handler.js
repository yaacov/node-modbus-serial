const stream = require("stream");

class ServerSerialPipeHandler extends stream.Transform {
    constructor({ maxBufferSize = 65536, interval, transformOptions }) {
        super(transformOptions);
        if (!interval) {
            throw new TypeError("\"interval\" is required");
        }
        if (typeof interval !== "number" || Number.isNaN(interval)) {
            throw new TypeError("\"interval\" is not a number");
        }
        if (interval < 1) {
            throw new TypeError("\"interval\" is not greater than 0");
        }
        if (typeof maxBufferSize !== "number" || Number.isNaN(maxBufferSize)) {
            throw new TypeError("\"maxBufferSize\" is not a number");
        }
        if (maxBufferSize < 1) {
            throw new TypeError("\"maxBufferSize\" is not greater than 0");
        }
        this.maxBufferSize = maxBufferSize;
        this.currentPacket = Buffer.from([]);
        this.interval = interval;
    }

    _transform(chunk, encoding, cb) {
        if (this.intervalID) {
            clearTimeout(this.intervalID);
        }

        let offset = 0;
        while ((this.currentPacket.length + chunk.length) >= this.maxBufferSize) {
            this.currentPacket = Buffer.concat([this.currentPacket, chunk.slice(offset, this.maxBufferSize - this.currentPacket.length)]);
            offset = offset + this.maxBufferSize;
            chunk = chunk.slice(offset);
            this.emitPacket();
        }
        this.currentPacket = Buffer.concat([this.currentPacket, chunk]);
        this.intervalID = setTimeout(this.emitPacket.bind(this), this.interval);
        cb();
    }
    emitPacket() {
        if (this.intervalID) {
            clearTimeout(this.intervalID);
        }
        if (this.currentPacket.length > 0) {
            this.push(this.currentPacket);
        }
        this.currentPacket = Buffer.from([]);
    }
    _flush(cb) {
        this.emitPacket();
        cb();
    }
}

module.exports = ServerSerialPipeHandler;
