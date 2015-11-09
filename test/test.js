'use strict';
var TestPort = require("./testport");
var testPort = new TestPort();
var ModbusRTU = require("../index");
var modbusRTU = new ModbusRTU(testPort);

var expect = require('chai').expect;

describe('ModbusRTU', function() {
  
  describe('#open() - open serial port.', function () {
    it('should open the port without errors', function (done) {
      modbusRTU.open(function(err) {
        expect(err).to.be.a('null');
        
        done();
      });
    });
  });
  
  describe('#writeFC3() - read holding registers.', function () {
    it('should read 3 registers [0xa12b, 0xffff, 0xb21a] without errors', function (done) {
        modbusRTU.writeFC3(1, 8, 3, function(err, data) {
            expect(err).to.be.a('null');
            expect(data).to.have.property('data').with.length(3);
            expect(data.data.toString()).to.equal([0xa12b, 0xffff, 0xb21a].toString());
            done()
        });
    });
    
    it('should read raw buffer "a12bffffb21a" without errors', function (done) {
        modbusRTU.writeFC3(1, 8, 3, function(err, data) {
            expect(err).to.be.a('null');
            expect(data).to.have.property('buffer');
            expect(data.buffer.toString('hex')).to.equal("a12bffffb21a");
            done()
        });
    });
  });
  
  describe('#writeFC4() - read input registers.', function () {
    it('should read 3 registers [8, 9, 10] without errors', function (done) {
        modbusRTU.writeFC4(1, 8, 3, function(err, data) {
            expect(err).to.be.a('null');
            expect(data).to.have.property('data').with.length(3);
            expect(data.data.toString()).to.equal([8, 9, 10].toString());
            done()
        });
    });
    
    it('should fail on short data answer', function (done) {
        modbusRTU.writeFC4(2, 8, 1, function(err, data) {
            expect(err).to.equal('Data length error');
            
            done()
        });
    });
    
    it('should fail on CRC error', function (done) {
        modbusRTU.writeFC4(3, 8, 1, function(err, data) {
            expect(err).to.equal('CRC error');
            
            done()
        });
    });
    
    it('should fail on unexpected replay', function (done) {
        modbusRTU.writeFC4(4, 8, 1, function(err, data) {
            expect(err).to.equal('Unexpected data error');
            
            done()
        });
    });
  });
  
  describe('#writeFC16() - write registers.', function () {
    it('should write 3 registors [42, 128, 5] without errors', function (done) {
        modbusRTU.writeFC16(1, 8, [42, 128, 5], function(err, data) {
            expect(err).to.be.a('null');
            
            done()
        });
    });
    
    it('should fail on short data answer', function (done) {
        modbusRTU.writeFC16(2, 8, [42, 128, 5], function(err, data) {
            expect(err).to.equal('Data length error');
            
            done()
        });
    });
    
    it('should fail on CRC error', function (done) {
        modbusRTU.writeFC16(3, 8, [42, 128, 5], function(err, data) {
            expect(err).to.equal('CRC error');
            
            done()
        });
    });
    
    it('should fail on unexpected replay', function (done) {
        modbusRTU.writeFC16(4, 8, [42, 128, 5], function(err, data) {
            expect(err).to.equal('Unexpected data error');
            
            done()
        });
    });
  });
  
  describe('#writeFC4() - read input registers after write.', function () {
    it('should read 3 registers [42, 128, 5] without errors', function (done) {
        modbusRTU.writeFC4(1, 8, 3, function(err, data) {
            expect(err).to.be.a('null');
            expect(data).to.have.property('data').with.length(3);
            expect(data.data.toString()).to.equal([42, 128, 5].toString());
            done()
        });
    });
  });
  
});

