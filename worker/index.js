"use strict";

function getByteLength(type) {
    switch (String(type).toLowerCase()) {
        case "int16":
        case "uint16":
            return 2;
        case "int32":
        case "uint32":
        case "float":
            return 4;
        default:
            throw new Error("Unsupported type");
    }
}

function send({ fc, unit, address, arg }) {

    this._port.setID(unit);

    switch (fc) {
        case 1:  return this._port.readCoils(address, arg);
        case 2:  return this._port.readDiscreteInputs(address, arg);
        case 3:  return this._port.readHoldingRegisters(address, arg);
        case 4:  return this._port.readInputRegisters(address, arg);

        case 5:  return this._port.writeCoil(address, arg);
        case 6:  return this._port.writeRegister(address, arg);
        case 15: return this._port.writeCoils(address, arg);
        case 16: return this._port.writeRegisters(address, arg);
    }

    return Promise.reject(new Error("Unknown fc code"));
}

const Worker = function(port, options) {
    if (typeof(options) === "undefined") options = {};

    this.maxConcurrentRequests = 1;

    this.debug = false;

    this._port = port;

    this._queue = [];

    this._scheduled = [];

    this._running = new Map();

    this._nextId = 0;

    this.setOptions(options);
};

Worker.prototype.setOptions = function({ maxConcurrentRequests, debug }) {
    if(maxConcurrentRequests > 0) {
        this.maxConcurrentRequests = maxConcurrentRequests;
    }

    if(debug !== undefined) {
        this.debug = Boolean(debug);
    }
};
Worker.prototype.log = function(...args) {
    if(this.debug === true) {
        args.unshift(new Date());
        console.log(...args);
    }
};
Worker.prototype.emit = function(name, data) {
    this._port.emit(name, data);
};
Worker.prototype.bufferize = function(data, type) {

    if(Array.isArray(data) === false) {
        data = [data];
    }

    const quantity = data.length;
    const byteLength = getByteLength(type);
    const size = quantity * byteLength;
    const buffer = Buffer.alloc(size);

    for(let i = 0; i < quantity; i++) {
        if(type === "int16") {
            buffer.writeInt16BE(data[i], i * byteLength);
        } else if(type === "uint16") {
            buffer.writeUInt16BE(data[i], i * byteLength);
        } else if(type === "int32") {
            buffer.writeInt32BE(data[i], i * byteLength);
        } else if(type === "uint32") {
            buffer.writeUInt32BE(data[i], i * byteLength);
        } else if(type === "float") {
            buffer.writeFloatBE(data[i], i * byteLength);
        }
    }

    return buffer;
};
Worker.prototype.unbufferize = function(buffer, type) {
    const byteLength = getByteLength(type);
    const quantity = buffer.length / byteLength;
    const data = [];

    for(let i = 0; i < quantity; i++) {
        if(type === "int16") {
            data.push(buffer.readInt16BE(i * byteLength));
        } else if(type === "uint16") {
            data.push(buffer.readUInt16BE(i * byteLength));
        } else if(type === "int32") {
            data.push(buffer.readInt32BE(i * byteLength));
        } else if(type === "uint32") {
            data.push(buffer.readUInt32BE(i * byteLength));
        } else if(type === "float") {
            data.push(buffer.readFloatBE(i * byteLength));
        }
    }

    return data;
};

Worker.prototype.nextId = function() {
    this._nextId = this._nextId + 1;

    if(this._nextId > 9999) {
        this._nextId = 1;
    }

    return this._nextId;
};
Worker.prototype.send = function({ fc, unit, address, value, quantity, arg, type }) {
    const promise = new Promise((resolve, reject) => {

        arg = arg || quantity || value;

        if(fc === 1 || fc === 2) {
            arg = arg || 1;
        }

        if(fc === 3 || fc === 4) {
            type = type || "int16";
            arg = (arg || 1) * getByteLength(type) / 2;
        }

        if(fc === 6 || fc === 16) {
            type = type || "int16";
            arg = this.bufferize(arg, type);
            if(fc === 6 && arg.length > 2) {
                fc = 16;
            }
        }

        if(fc === 5 && arg instanceof Array && arg.length > 1) {
            fc = 15;
        }

        const id = this.nextId();

        this.log("queue push", `#${id}`, fc, unit, address, arg, type);
        this._queue.push({ id, fc, unit, address, arg, type, resolve, reject });
    });

    this.process();

    return promise;
};
Worker.prototype.process = function() {
    if(this._port.isOpen === false) {
        this._queue = [];
        this._scheduled = [];
        this._running = new Map();
        this._nextId = 0;
        return;
    }

    setTimeout(() => this.run(), 1);
};
Worker.prototype.run = function() {
    if(this._running.size >= this.maxConcurrentRequests) {
        return;
    }

    let request = this._queue.shift();

    if(!request) {
        request = this._scheduled.shift();
    }

    if(!request) {
        return; // Well Done
    }

    if(typeof request.checkBeforeQueuing === "function") {
        if(request.checkBeforeQueuing() === false) {
            return this.process(); // Skip current request and go on
        }
    }

    this._running.set(request.id, request);

    this.log("send", JSON.stringify(request));

    this.emit("request", { request });

    send.apply(this, [request])
        .then((response) => {
            let data = [];

            if(request.fc === 1 || request.fc === 2) {
                for(let i = 0; i < request.arg; i++) {
                    data.push(Boolean(response.data[i]));
                }
            } else if(request.fc === 3 || request.fc === 4) {
                data = this.unbufferize(response.buffer, request.type);
            } else if(request.arg instanceof Array) {
                data = request.arg;
            } else if(request.arg instanceof Buffer && request.type) {
                data = this.unbufferize(request.arg, request.type);
            } else {
                data.push(request.arg);
            }

            this._running.delete(request.id);

            this.emit("response", { request, response: data });

            request.resolve(data);

            this.process();
        })
        .catch((error) => {
            this._running.delete(request.id);

            error.request = request;

            this.emit("failed", error);

            request.reject(error);

            this.process();
        });

    this.process();
};

Worker.prototype._poll_send = function(result, { i, fc, unit, address, arg, items, length, type }, { skipErrors }) {
    const promise = new Promise((res, rej) => {
        const id = this.nextId();

        this.log("scheduled push", "poll #" + result.id, "req #" + i, "#" + id, fc, length, type);

        const resolve = function(response) {
            const data = items.map((address, index) => ({ address, value: response[index] }));
            result._req += 1;
            result.done += 1;
            result.data = [...result.data, ...data];
            res(data);
        };

        const reject = function(error) {
            result._req += 1;
            result.error = error;
            rej(error);
        };

        const checkBeforeQueuing = function() {
            return result.error === null || skipErrors === true;
        };

        this._scheduled.push({ id, i, fc, unit, address, arg, items, length, type, result, checkBeforeQueuing, resolve, reject });
    });

    this.process();

    return promise;
};

Worker.prototype.poll = function({ unit, map, onProgress, maxChunkSize, skipErrors, defaultType }) {
    maxChunkSize = maxChunkSize || 32;
    skipErrors = Boolean(skipErrors);
    defaultType = defaultType || "int16";

    if(unit < 1 || unit > 250 || isNaN(unit) || unit === undefined) {
        throw new Error("invalid unit");
    }

    this.log("poll", `unit=${unit}`, "map size=" + Object.keys(map).length, `maxChunkSize=${maxChunkSize}`, `skipErrors=${skipErrors}`);

    const result = {
        id: this.nextId(),
        unit,
        total: 0,
        done: 0,
        data: [],
        error: null,
        dt: Date.now(),
        _req: 0
    };

    const registers = [];
    map.forEach(({ fc, address, type }) => {
        fc = parseInt(fc);

        if(fc === 3 || fc === 4) {
            type = type || defaultType;
        } else if(fc === 1 || fc === 2) {
            type = "bool";
        } else {
            throw new Error("unsupported fc");
        }

        if(address instanceof Array) {
            address.forEach((item) => {
                registers.push({ fc, address: parseInt(item), type: type || null });
            });
        } else {
            address = parseInt(address);
            registers.push({ fc, address, type: type || null });
        }
    });

    registers.sort((a, b) => {
        if(a.fc === b.fc) {
            return a.address - b.address;
        }

        return a.fc - b.fc;
    });

    const requests = registers.reduce(function(chunks, register, i, arr) {
        let chunk = 0;

        if(chunks.length) {
            chunk = chunks.length - 1;
        }

        if(i > 0) {
            const lastRegister = arr[i - 1];

            if(lastRegister.fc !== register.fc) {
                chunk += 1;
            } else if(lastRegister.type !== register.type) {
                chunk += 1;
            } else if([3, 4].indexOf(register.fc) >= 0 && register.address - lastRegister.address !== getByteLength(register.type) / 2) {
                chunk += 1;
            } else if(chunks[chunk].items.length >= maxChunkSize) {
                chunk += 1;
            }
        }

        if(chunks[chunk] === undefined) {
            chunks[chunk] = {
                fc: register.fc,
                items: [],
                length: 0,
                type: register.type
            };
        }

        chunks[chunk].items.push(register.address);

        if ([3, 4].indexOf(register.fc) >= 0) {
            chunks[chunk].length += getByteLength(register.type) / 2;
        } else {
            chunks[chunk].length += 1;
        }

        return chunks;
    }, []);

    result.total = requests.length;

    return new Promise(((resolve) => {
        const check = function() {
            if(result._req === result.total) {
                result.dt = Date.now() - result.dt;
                resolve(result);
            } else if(result.error && skipErrors !== true) {
                result.dt = Date.now() - result.dt;
                resolve(result);
            }
        };

        for(let i = 0; i < requests.length; i++) {
            const { fc, items, length, type } = requests[i];

            this._poll_send(result, { i, unit, fc, address: parseInt(items[0]), items, arg: length, length, type }, {
                skipErrors
            })
                .then((data) => {
                    if(typeof onProgress === "function") {
                        onProgress(result.done / result.total, data);
                    }
                    check();
                })
                .catch(() => check());
        }
    }));
};

module.exports = Worker;
