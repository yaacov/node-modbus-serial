'use strict';
var expect = require('chai').expect;
var net = require('net');

var DummyPort = require('./dummyport');
var TcpPort = require('./../../ports/tcpport');

var IP_ADDRESS = '127.0.0.1';
var PORT = 2027;

describe('Modbus TCP port', function() {
    var server = net.createServer(function(socket) {
        socket.on('data', function(data) {
            if (data.equals(new Buffer('0001000000061103006B0003', 'hex'))) {
                socket.write(new Buffer('000100000006110366778899', 'hex'));
            }
        });
    });
    server.listen(PORT, IP_ADDRESS);

    var port = new TcpPort(IP_ADDRESS, {port:PORT});

    afterEach(function() {
        port.close();
    });

    after(function(done) {
       server.close(done);
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

        it('should not be open after #close', function() {
            port.open(function() {
                port.close(function() {
                    expect(port.isOpen()).to.be.true;
                    done();
                });
            });
        });
    });

    describe('data handler', function() {
        it('should return a valid Modbus RTU message', function(done) {
            port.once('data', function(data) {
                expect(data.toString('hex')).to.equal('1103667788994fa2');
                done();
            });
            port.open(function() {
                // will write 0001000000061103006B0003
                port.write(new Buffer('1103006B00037687', 'hex'));
            });
        });
    });

    describe('#write', function() {
        it('should write a valid TCP message to the port', function() {
            var dummyPort = new DummyPort();
            port._client = dummyPort;
            port.write(new Buffer('1103006B00037687', 'hex'));
            expect(dummyPort.data.toString('hex')).to.equal('0001000000061103006b0003');
        });
    });

});
