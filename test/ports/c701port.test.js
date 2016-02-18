'use strict';
var expect = require('chai').expect;
var mockery = require('mockery');

describe('Modbus UDP port', function() {
    var port;

    before(function() {
        var mock = require('./../mocks/dgramMock');
        mockery.resetCache();
        mockery.enable({warnOnReplace:false, useCleanCache:true, warnOnUnregistered:false});
        mockery.registerMock('dgram', mock);
        var UdpPort = require('./../../ports/c701port');
        port = new UdpPort('127.0.0.1', {port:9999});
    });

    after(function() {
        mockery.disable();
    });

    afterEach(function() {
        port.close();
    });

    describe('#isOpen', function() {
        it('should not be open before #open', function() {
           expect(port.isOpen()).to.be.false;
        });

        it('should be open after onListening', function(done) {
            port._client.listen();
            setTimeout(function() {
                expect(port.isOpen()).to.be.true;
                done();
            }, 100);
        });

        it('should not be open after #close', function(done) {
            port._client.listen();
            setTimeout(function() {
                port.close(function() {
                    expect(port.isOpen()).to.be.false;
                    done();
                });
            }, 100);
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

                if (port._client._data.slice(-8).equals(new Buffer('1103006B00037687', 'hex'))) {
                    var buffer = new Buffer(116 + 11).fill(0);
                    buffer.writeUInt16LE(602, 2);           // C701 magic for serial bridge
                    buffer.writeUInt16LE(0, 36);            // C701 RS485 connector (0..2)
                    buffer.writeUInt16LE(0, 38);            // expected serial answer length
                    buffer.writeUInt16LE(1, 102);           // C7011 RS481 hub (1..2)
                    buffer.writeUInt16LE(11, 104);          // serial data length

                    // add serial line data
                    new Buffer('110306ae415652434049ad', 'hex').copy(buffer, 116);
                    port._client.receive(buffer);
                }
            });
        });
    });

    describe('#write', function() {
        it('should write a valid message to the port', function() {
            port.write(new Buffer('1103006B00037687', 'hex'));
            expect(port._client._data.length).to.equal(116 + 8);
            expect(port._client._data.slice(-8).toString('hex')).to.equal('1103006b00037687');
        });
    });

});
