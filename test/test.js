'use strict';

// Create test port
// ----------------
var util = require('util');
var events = require('events');

var TestPort = function() {
    this._buffer = new Buffer('', 'hex');
    events.call(this);
}
util.inherits(TestPort, events);

TestPort.prototype.open = function (callback) {
    callback(null);
}
TestPort.prototype.write = function (buf) {
    this._buffer = new Buffer('110402000AF8F4', 'hex');
    this.emit('data', this._buffer);
}

// Start test
// ----------
var testPort = new TestPort();
var ModbusRTU = require("../index");
var modbusRTU = new ModbusRTU(testPort);

var expect = require('chai').expect;

describe('ModbusRTU', function() {
  describe('#open()', function () {
    it('should open the port without errors', function () {
      modbusRTU.open(function(err) {
        expect(err).to.be.a('null');
      });
    });
  });
  
  describe('#writeFC4()', function () {
    it('should return one register without errors', function () {
      modbusRTU.writeFC4(17, 8, 1, function(err, data) {
        expect(err).to.be.a('null');
        expect(data).to.have.property('Data').with.length(1);
      });
    });
  });
  
  describe('#writeFC16()', function () {
    it('should fail with data length error', function () {
      modbusRTU.writeFC4(17, 8, [0xffff], function(err, data) {
        expect(err).to.equal('Data length error');
      });
    });
  });
});

