/* eslint-disable no-console, spaced-comment, func-call-spacing, no-spaced-func */

//==============================================================
// This is an example of polling (reading) Holding Registers
// on a regular scan interval with timeouts enabled.
// For robust behaviour, the next action is not activated
// until the previous action is completed (callback served).
//==============================================================

"use strict";

//==============================================================
// create an empty modbus client
var ModbusRTU   = require ("modbus-serial");
var client      = new ModbusRTU();

var mbsStatus   = "Initializing...";    // holds a status of Modbus

// Modbus 'state' constants
var MBS_STATE_INIT          = "State init";
var MBS_STATE_IDLE          = "State idle";
var MBS_STATE_NEXT          = "State next";
var MBS_STATE_GOOD_READ     = "State good (read)";
var MBS_STATE_FAIL_READ     = "State fail (read)";
var MBS_STATE_GOOD_CONNECT  = "State good (port)";
var MBS_STATE_FAIL_CONNECT  = "State fail (port)";

// Modbus TCP configuration values
var mbsId       = 1;
var mbsPort     = 502;
var mbsHost     = "192.168.20.2";
var mbsScan     = 1000;
var mbsTimeout  = 5000;
var mbsState    = MBS_STATE_INIT;


//==============================================================
var connectClient = function()
{
    // close port (NOTE: important in order not to create multiple connections)
    client.close();

    // set requests parameters
    client.setID      (mbsId);
    client.setTimeout (mbsTimeout);

    // try to connect
    client.connectTCP (mbsHost, { port: mbsPort })
        .then(function()
        {
            mbsState  = MBS_STATE_GOOD_CONNECT;
            mbsStatus = "Connected, wait for reading...";
            console.log(mbsStatus);
        })
        .catch(function(e)
        {
            mbsState  = MBS_STATE_FAIL_CONNECT;
            mbsStatus = e.message;
            console.log(e);
        });

};


//==============================================================
var readModbusData = function()
{
    // try to read data
    client.readHoldingRegisters (0, 18)
        .then(function(data)
        {
            mbsState   = MBS_STATE_GOOD_READ;
            mbsStatus  = "success";
            console.log(data.buffer);
        })
        .catch(function(e)
        {
            mbsState  = MBS_STATE_FAIL_READ;
            mbsStatus = e.message;
            console.log(e);
        });
};


//==============================================================
var runModbus = function()
{
    var nextAction;

    switch (mbsState)
    {
        case MBS_STATE_INIT:
            nextAction = connectClient;
            break;

        case MBS_STATE_NEXT:
            nextAction = readModbusData;
            break;

        case MBS_STATE_GOOD_CONNECT:
            nextAction = readModbusData;
            break;

        case MBS_STATE_FAIL_CONNECT:
            nextAction = connectClient;
            break;

        case MBS_STATE_GOOD_READ:
            nextAction = readModbusData;
            break;

        case MBS_STATE_FAIL_READ:
            if (client.isOpen)  { mbsState = MBS_STATE_NEXT;  }
            else                { nextAction = connectClient; }
            break;

        default:
            // nothing to do, keep scanning until actionable case
    }

    console.log();
    console.log(nextAction);

    // execute "next action" function if defined
    if (nextAction !== undefined)
    {
        nextAction();
        mbsState = MBS_STATE_IDLE;
    }

    // set for next run
    setTimeout (runModbus, mbsScan);
};

//==============================================================
runModbus();
