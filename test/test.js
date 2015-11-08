'use strict';
var TestPort = require("./testport");
var testPort = new TestPort();
var ModbusRTU = require("../index");
var modbusRTU = new ModbusRTU(testPort);

var expect = require('chai').expect;

describe('ModbusRTU', function() {
  describe('#open()', function () {
    it('should open the port without errors', function (done) {
      modbusRTU.open(function(err) {
        expect(err).to.be.a('null');
        
        done();
      });
    });
  });
  
  describe('#writeFC4()', function () {
    it('should return one register without errors', function (done) {
        modbusRTU.writeFC4(1, 8, 1, function(err, data) {
            expect(err).to.be.a('null');
            expect(data).to.have.property('Data').with.length(1);
            
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
  
  describe('#writeFC16()', function () {
    it('should return without errors', function (done) {
        modbusRTU.writeFC16(1, 8, [0x0000, 0xffff], function(err, data) {
            expect(err).to.be.a('null');
            
            done()
        });
    });
    
    it('should fail on short data answer', function (done) {
        modbusRTU.writeFC16(2, 8, [0x0000, 0xffff], function(err, data) {
            expect(err).to.equal('Data length error');
            
            done()
        });
    });
    
    it('should fail on CRC error', function (done) {
        modbusRTU.writeFC16(3, 8, [0x0000, 0xffff], function(err, data) {
            expect(err).to.equal('CRC error');
            
            done()
        });
    });
    
    it('should fail on unexpected replay', function (done) {
        modbusRTU.writeFC16(4, 8, [0x0000, 0xffff], function(err, data) {
            expect(err).to.equal('Unexpected data error');
            
            done()
        });
    });
  });
});

