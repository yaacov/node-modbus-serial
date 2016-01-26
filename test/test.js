'use strict';
var ModbusRTU = require("../index");
var TestPort = ModbusRTU.TestPort;
var testPort = new TestPort();
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
            expect(err).to.have.string('Data length error');

            done()
        });
    });

    it('should fail on CRC error', function (done) {
        modbusRTU.writeFC4(3, 8, 1, function(err, data) {
            expect(err).to.have.string('CRC error');

            done()
        });
    });

    it('should fail on unexpected replay', function (done) {
        modbusRTU.writeFC4(4, 8, 1, function(err, data) {
            expect(err).to.have.string('Unexpected data error');

            done()
        });
    });
  });

  describe('#writeFC6() - write single holding register.', function () {
    it('should write to register 1 42 without errors', function (done) {
      modbusRTU.writeFC6(1, 1, 42, function(err, data) {
        expect(err).to.be.a('null');
        expect(data.address).to.equal(1);
        expect(data.value).to.equal(42);

        done()
      });
    });

    it('should fail on short data answer', function (done) {
      modbusRTU.writeFC6(2, 1, 42, function(err, data) {
        expect(err).to.have.string('Data length error');

        done()
      });
    });

    it('should fail on CRC error', function (done) {
      modbusRTU.writeFC6(3, 1, 42, function(err, data) {
        expect(err).to.have.string('CRC error');

        done()
      });
    });

    it('should fail on unexpected replay', function (done) {
      modbusRTU.writeFC6(4, 1, 42, function(err, data) {
        expect(err).to.have.string('Unexpected data error');

        done()
      });
    });
  });


  describe('#writeFC15() - force multiple coils.', function () {
    it('should write 3 coils [true, false, true] without errors', function (done) {
      modbusRTU.writeFC15(1, 8, [true, false, true], function(err, data) {
        expect(err).to.be.a('null');
        done()
      });
    });

    it('should fail on short data answer', function (done) {
      modbusRTU.writeFC15(2, 8, [true, false, true], function(err, data) {
        expect(err).to.have.string('Data length error');

        done()
      });
    });

    it('should fail on CRC error', function (done) {
      modbusRTU.writeFC15(3, 8, [true, false, true], function(err, data) {
        expect(err).to.have.string('CRC error');

        done()
      });
    });

    it('should fail on unexpected replay', function (done) {
      modbusRTU.writeFC15(4, 8, [true, false, true], function(err, data) {
        expect(err).to.have.string('Unexpected data error');

        done()
      });
    });
  });


  describe('#writeFC16() - write holding registers.', function () {
    it('should write 3 registers [42, 128, 5] without errors', function (done) {
        modbusRTU.writeFC16(1, 8, [42, 128, 5], function(err, data) {
            expect(err).to.be.a('null');

            done()
        });
    });

    it('should fail on short data answer', function (done) {
        modbusRTU.writeFC16(2, 8, [42, 128, 5], function(err, data) {
            expect(err).to.have.string('Data length error');

            done()
        });
    });

    it('should fail on CRC error', function (done) {
        modbusRTU.writeFC16(3, 8, [42, 128, 5], function(err, data) {
            expect(err).to.have.string('CRC error');

            done()
        });
    });

    it('should fail on unexpected replay', function (done) {
        modbusRTU.writeFC16(4, 8, [42, 128, 5], function(err, data) {
            expect(err).to.have.string('Unexpected data error');

            done()
        });
    });
  });

  describe('#writeFC3() - read holding registers after write.', function () {
    it('should read 3 registers [42, 128, 5] without errors', function (done) {
        modbusRTU.writeFC3(1, 8, 3, function(err, data) {
            expect(err).to.be.a('null');
            expect(data).to.have.property('data').with.length(3);
            expect(data.data.toString()).to.equal([42, 128, 5].toString());
            done()
        });
    });
  });

  describe('#writeFC5() - force one coil.', function () {
    it('should force coil 3 to be true, without errors', function (done) {
        modbusRTU.writeFC5(1, 3, true, function(err, data) {
            expect(err).to.be.a('null');
            expect(data).to.have.property('state');
            expect(data.state).to.equal(true);

            done()
        });
    });
  });

  describe('#writeFC1() - read coils after force coil.', function () {
    it('should read coil 3 to be true, without errors', function (done) {
        modbusRTU.writeFC1(1, 3, 9, function(err, data) {
            expect(err).to.be.a('null');
            expect(data).to.have.property('data');
            expect(data.data[0]).to.equal(true);
            expect(data.data[3]).to.equal(false);

            done()
        });
    });
  });

  describe('#writeFC1() - read inputs.', function () {
    it('should read input 0 to be false, without errors', function (done) {
        modbusRTU.writeFC1(1, 0, 9, function(err, data) {
            expect(err).to.be.a('null');
            expect(data).to.have.property('data');
            expect(data.data[0]).to.equal(false);
            expect(data.data[3]).to.equal(true);

            done()
        });
    });
  });

});

