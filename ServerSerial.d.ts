import * as events from 'events';
import { SerialPortOpenOptions } from "serialport"
import { FCallback, IServiceVector } from './ServerTCP';
import { ErrorCallback } from '@serialport/stream';

export class ServerSerial extends events.EventEmitter {
    constructor(vector: IServiceVector, options: IServerSerialOptions);
    close(cb: FCallback): void;
}

type IServerSerialOptions = SerialPortOpenOptions<any> & {
    debug?: boolean,
    unitID?: number,
    openCallback?: ErrorCallback
}

export declare interface ServerSerial {
    on(event: 'socketError', listener: FCallback): this;
    on(event: 'error', listener: FCallback): this;
    on(event: 'initialized', listener: FCallback): this;
}
