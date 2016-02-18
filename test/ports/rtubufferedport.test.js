'use strict';
var expect = require('chai').expect;
var mockery = require('mockery');

describe('Modbus RTU buffered port', function() {
    var port;

    before(function() {
        var mock = require('./../mocks/SerialPortMock');
        mockery.resetCache();
        mockery.enable({warnOnReplace:false, useCleanCache:true, warnOnUnregistered:false});
        mockery.registerMock('serialport', mock);
        var RTUBufferedPort = require('./../../ports/rtubufferedport');
        port = new RTUBufferedPort('dummy', {});
    });

    after(function() {
       mockery.disable;
    });

    afterEach(function() {
        port.close();
    });

    describe('#isOpen', function() {
        it('should not be open before #open', function() {
           expect(port.isOpen()).to.be.false;
        });

        it('should be open after #open', function(done) {
            port.open(function() {
                expect(port.isOpen()).to.be.true;
                done();
            });
        });

        it('should not be open after #close', function(done) {
            port.open(function() {
                port.close(function() {
                    expect(port.isOpen()).to.be.false;
                    done();
                });
            });
        });
    });

    describe('data handler', function() {
        it('should return a valid Modbus RTU message', function(done) {
            port.once('data', function(data) {
                expect(data.toString('hex')).to.equal('110306ae415652434049ad');
                done();
            });
            port.open(function() {
                port.write(new Buffer('1103006B00037687', 'hex'));
                setTimeout(function() {
                    port._client.receive(new Buffer('11', 'hex'));
                    port._client.receive(new Buffer('03', 'hex'));
                    port._client.receive(new Buffer('06', 'hex'));
                    port._client.receive(new Buffer('ae', 'hex'));
                    port._client.receive(new Buffer('41', 'hex'));
                    port._client.receive(new Buffer('56', 'hex'));
                    port._client.receive(new Buffer('52', 'hex'));
                    port._client.receive(new Buffer('43', 'hex'));
                    port._client.receive(new Buffer('40', 'hex'));
                    port._client.receive(new Buffer('49', 'hex'));
                    port._client.receive(new Buffer('ad', 'hex'));
                }, 100);
            });
        });
    });

    describe('#write', function() {
        it('should write a valid TCP message to the port', function() {
            port.write(new Buffer('1103006B00037687', 'hex'));
            expect(port._client._data.toString('hex')).to.equal('1103006b00037687');
        });
    });

});
