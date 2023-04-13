import * as events from 'events';

export class ServerTCP extends events.EventEmitter {
    constructor(vector: IServiceVector, options: IServerOptions);
    close(cb: FCallback): void;
}

interface IServiceVector {
    getCoil?:
        ((addr: number, unitID: number, cb: FCallbackVal<boolean>) => void) |
        ((addr: number, unitID: number) => Promise<boolean>) |
        ((addr: number, unitID: number) => boolean);
    getDiscreteInput?: 
        ((addr: number, unitID: number, cb: FCallbackVal<boolean>) => void) |
        ((addr: number, unitID: number) => Promise<boolean>) |
        ((addr: number, unitID: number) => boolean);
    getInputRegister?: 
        ((addr: number, unitID: number, cb: FCallbackVal<number>) => void) |
        ((addr: number, unitID: number) => Promise<number>) |
        ((addr: number, unitID: number) => number);
    getHoldingRegister?:
        ((addr: number, unitID: number, cb: FCallbackVal<number>) => void) |
        ((addr: number, unitID: number) => Promise<number>) |
        ((addr: number, unitID: number) => number);
    getMultipleInputRegisters?:
        ((addr: number, length: number, unitID: number, cb: FCallbackVal<number[]>) => void) |
        ((addr: number, length: number, unitID: number) => Promise<number[]>) |
        ((addr: number, length: number, unitID: number) => number[]);
    getMultipleHoldingRegisters?: 
        ((addr: number, length: number, unitID: number, cb: FCallbackVal<number[]>) => void) |
        ((addr: number, length: number, unitID: number) => Promise<number[]>) |
        ((addr: number, length: number, unitID: number) => number[]);
    setCoil?: 
        ((addr: number, value: boolean, unitID: number, cb: FCallback) => void) |
        ((addr: number, value: boolean, unitID: number) => Promise<void>) |
        ((addr: number, value: boolean, unitID: number) => void)
    setRegister?: 
        ((addr: number, value: number, unitID: number, cb: FCallback) => void) |
        ((addr: number, value: number, unitID: number) => Promise<void>) |
        ((addr: number, value: number, unitID: number) => void)
	setRegisterArray?:
        ((addr: number, value: number[], unitID: number, cb: FCallback) => void) |
        ((addr: number, value: number[], unitID: number) => Promise<void>) |
        ((addr: number, value: number[], unitID: number) => void);
}

interface IServerOptions {
    host?: string,
    port?: number,
    debug?: boolean,
    unitID?: number,
}

export declare interface ServerTCP {
    on(event: 'socketError', listener: FCallback): this;
    on(event: 'error', listener: FCallback): this;
    on(event: 'initialized', listener: FCallback): this;
}

type FCallbackVal<T> = (err: Error | null, value: T) => void;
type FCallback = (err: Error | null) => void;
