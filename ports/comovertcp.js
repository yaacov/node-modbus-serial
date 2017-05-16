/**
 * Created by YX on 2016/9/10.
 */
'use strict';
var util = require('util');
var events = require('events');
var EventEmitter = events.EventEmitter || events;
var _ = require('underscore');
var net = require('net');
var MODBUS_PORT = 4001; // modbus port
var MAX_TRANSACTIONS = 64; // maximum transaction to wait for
var ModbusRTU = require('modbus-serial');

/**
 * Simulate a modbus-RTU port using modbus-TCP connection
 */
var ComOverTcpPort = function(ip_port, options) {
    EventEmitter.call(this);
    var modbus = this;
    var portSplit = ip_port.split(':');
    this.ip = portSplit[0];
    this.port = parseInt(portSplit[1]);
    this.openFlag = false;
    this.connected = false;
    this.callback = null;
    this.connecting = false;
    this._client = new net.Socket();
    this.writeStarted = false;
    // options
    this.options =  options  || {};
    

    // handle callback - call a callback function only once, for the first event
    // it will triger
    var handleCallback = function(had_error) {
        if (modbus.callback) {
            modbus.callback(had_error);
            modbus.callback = null;
        }
    }

    // create a socket

    this._client.on('data', function(data) {
        modbus.connecting = false;
        if( this.writeStarted){
            if(this.options.parser){
                this.options.parser(data)
            }else{
                let  firstNoZero = 0;
                for(let i = 0; i < data.length; i++){
                    if(data.readUInt8(i) !== 0){
                        firstNoZero = i;
                        break;
                    }
                }
                var buffer = new Buffer(data.length-firstNoZero);
                data.copy(buffer,0,firstNoZero, data.length-firstNoZero);
                //console.log('data received:',buffer);
                // emit a data signal
                modbus.emit('data', buffer);
            }

        }else{
            console.error('recv data before write!!',data);
        }

    }.bind(this));

    this._client.on('connect', function() {
        modbus.connected = true;
        modbus.connecting = false;
        handleCallback();

    });

    this._client.on('close', function(hadError) {
        modbus.connected = false;
        modbus.connecting = false;
        handleCallback(hadError);

    });

    this._client.on('error', function(e) {
        modbus.connected = false;
        modbus.connecting = false;
        handleCallback(e);
        modbus._client.end();
    });


    this.connect();
    this.setupReconnector();
};
util.inherits(ComOverTcpPort, EventEmitter);

ComOverTcpPort.prototype.setupReconnector = function () {
    setInterval(function(){
        if(this.openFlag){
            if(!this.connected && !this.connecting){
                console.log('reconnect to server...'+this.ip +":"+this.port);
                this.connect();
            }
        }

    }.bind(this),3000);

};
ComOverTcpPort.prototype.connect = function(){

    this.connecting = true;
    this._client.connect(this.port, this.ip);

}
/**
 * Simulate successful port open
 */
ComOverTcpPort.prototype.open = function (callback) {

    this.openFlag = true;
    this.callback = callback;

};

/**
 * Simulate successful close port
 */
ComOverTcpPort.prototype.close = function (callback) {
    this.callback = callback;
    this.openFlag = false;
    this._client.end();
};

/**
 * Check if port is open
 */
ComOverTcpPort.prototype.isOpen = function() {
    return this.connected;
};

/**
 * Send data to a modbus-tcp slave
 */
ComOverTcpPort.prototype.write = function (data) {
    this.writeStarted = true;
    /*
    // get next transaction id
    var transactionsId = (this._transactionId + 1) % MAX_TRANSACTIONS;
    // remove crc and add mbap
    var buffer = new Buffer(data.length + 6 - 2);
    buffer.writeUInt16BE(transactionsId, 0);
    buffer.writeUInt16BE(0, 2);
    buffer.writeUInt16BE(data.length - 2, 4);
    data.copy(buffer, 6);
    */
    if(_.isFunction(data.copy)){
        var buffer = new Buffer(data.length);
        data.copy(buffer,0,0, data.length);
        // send buffer to slave
        this._client.write(buffer);
    }else{
        var buffer = data.split(' ').map(function (data) {
            return parseInt(data, 16);
        });
        this._client.write(new Buffer(buffer));
    }

};

module.exports = ComOverTcpPort;
