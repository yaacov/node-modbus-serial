const Worker = require("../worker/index");

module.exports = function(Modbus) {
    const cl = Modbus.prototype;


    cl.setWorkerOptions = function(options) {
        if (this._worker) {
            this._worker.setOptions(options);
        } else {
            this._worker = new Worker(this, options);
        }
    };

    cl.send = function(request) {
        if(!this._worker) {
            this._worker = new Worker(this);
        }

        return this._worker.send(request);
    };

    cl.poll = function(options) {
        if(!this._worker) {
            this._worker = new Worker(this);
        }

        return this._worker.poll(options);
    };

};
