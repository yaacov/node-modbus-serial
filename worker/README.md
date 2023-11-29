#### See also modbusdb

The worker class is a simple class that makes it easy to grab some data from device, for a more complete module see modbusdb https://github.com/yarosdev/modbusdb

------------

#### What can I do with this module ?

This class makes it easy to grab some data from device.
Also, it handles typecast to int32, uint32, float etc.
Type 'double' is not supported by nodejs...

#### Examples

###### Setup client and worker
```` javascript
const client = new ModbusRTU()

client.connect..........

client.setWorkerOptions({
    maxConcurrentRequests: 10, // it will send 10 requests or less at a time if any
    debug: true
})
````
###### Read some data
``` javascript
// Read 4 values starting from 10009 register. 
// Under the hood it will read 8 registers due to int32 type
const response = await client.send({
    unit: 1,
    fc: 3,
    address: 10009,
    quantity: 4,
    type: 'int32',
});
````
###### Write some data
``` javascript
// Write 2 values to address: 10009 and 10011
const response = await client.send({
    unit: 1,
    fc: 16,
    address: 10009,
    value: [10999, 10888],
    type: 'int32',
});
````
###### Poll some data
``` javascript
// It will build all READ requests for you in optimal way
const response = await client.poll({
    unit: 1,
    map: [
        { fc: 3, address: [10011, 10013, 10018], type: "int32" },
        { fc: 3, address: 10003, type: "int32" },
        { fc: 3, address: 10005, type: "int32" },
        { fc: 3, address: 10007, type: "int32" },
        { fc: 3, address: 10009, type: "int32" },
        { fc: 2, address: [1,2,3]},
        { fc: 1, address: [1,2,3]},
        { fc: 1, address: 4},
        { fc: 1, address: 5},
        { fc: 1, address: 6},
        { fc: 3, address: [10001]}, // default type is int16
        { fc: 3, address: [10020, 10023, 10026], type: "float"},
        { fc: 3, address: [10030, 10034], type: "double"}
    ],
    onProgress: (progress, data) => {
        console.log(
            progress, // Poll progress from 0...1 where 1 means 100%
            data,     // Data from the current request
        );
    },
    maxChunkSize: 32,  // max registers per request
    skipErrors: false, // if false it will stop poll and return PARTIAL result
})
```
