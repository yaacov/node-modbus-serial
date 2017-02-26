declare namespace ModbusRTU {
  interface IModbusRTU {
    new(port?: any): IModbusRTU;

    open(callback: Function): void;
    close(callback: Function): void;

    writeFC1(address: number, dataAddress: number, length: number, next: NodeStyleCallback<ReadCoilResult>): void;
    writeFC2(address: number, dataAddress: number, length: number, next: NodeStyleCallback<ReadCoilResult>): void;
    writeFC3(address: number, dataAddress: number, length: number, next: NodeStyleCallback<ReadRegisterResult>): void;
    writeFC4(address: number, dataAddress: number, length: number, next: NodeStyleCallback<ReadRegisterResult>): void;
    writeFC5(address: number, dataAddress: number, state: boolean, next: NodeStyleCallback<WriteCoilResult>): void;
    writeFC6(address: number, dataAddress: number, value: number, next: NodeStyleCallback<WriteRegisterResult>): void;

    writeFC15(address: number, dataAddress: number, states: Array<boolean>, next: NodeStyleCallback<WriteMultipleResult>): void;
    writeFC16(address: number, dataAddress: number, values: Array<number>, next: NodeStyleCallback<WriteMultipleResult>): void;

    // Connection shorthand API
    connectRTU(path: string, options: SerialPortOptions, next: Function): Promise<void>;
    connectTCP(ip: string, options: TcpPortOptions, next: Function): Promise<void>;
    connectTcpRTUBuffered(ip: string, options: TcpRTUPortOptions, next: Function): Promise<void>;
    connectTelnet(ip: string, options: TelnetPortOptions, next: Function): Promise<void>;
    connectC701(ip: string, options: C701PortOptions, next: Function): Promise<void>;
    connectRTUBuffered(path: string, options: SerialPortOptions, next: Function): Promise<void>;
    connectAsciiSerial(path: string, options: SerialPortOptions, next: Function): Promise<void>;

    // Promise API
    setID(id: number): void;
    getID(): number;
    setTimeout(duration: number): void;
    getTimeout(): number;

    readCoils(dataAddress: number, length: number): Promise<ReadCoilResult>;
    readDiscreteInputs(dataAddress: number, length: number): Promise<ReadCoilResult>;
    readHoldingRegisters(dataAddress: number, length: number): Promise<ReadRegisterResult>;
    readInputRegisters(dataAddress: number, length: number): Promise<ReadRegisterResult>;
    writeCoil(dataAddress: number, state: boolean): Promise<WriteCoilResult>;
    writeRegister(dataAddress: number, value: number): Promise<WriteRegisterResult>;
    writeRegisters(dataAddress: number, values: Array<number>): Promise<WriteMultipleResult>; // 16
  }

  interface NodeStyleCallback<T> {
    (err: NodeJS.ErrnoException, param: T): void;
  }

  interface ReadCoilResult {
    data: Array<boolean>;
    buffer: Buffer;
  }

  interface ReadRegisterResult {
    data: Array<number>;
    buffer: Buffer;
  }

  interface WriteCoilResult {
    address: number;
    state: boolean;
  }

  interface WriteRegisterResult {
    address: number;
    value: number;
  }

  interface WriteMultipleResult {
    address: number;
    length: number;
  }

  interface SerialPortOptions {
    baudRate?: number;
    dataBits?: number;
    stopBits?: number;
    parity?: 'none' | 'even' | 'mark' | 'odd' | 'space';
    rtscts?: boolean;
    xon?: boolean;
    xoff?: boolean;
    xany?: boolean;
    flowControl?: boolean | Array<string>;
    bufferSize?: number;
    parser?: any;
    platformOptions?: SerialPortUnixPlatformOptions;
  }

  interface SerialPortUnixPlatformOptions {
    vmin?: number;
    vtime?: number;
  }

  interface TcpPortOptions {
    port?: number;
  }

  interface TcpRTUPortOptions {
    port?: number;
    removeCRC?: boolean;
  }

  interface TelnetPortOptions {
    port?: number;
  }

  interface C701PortOptions {
    port?: number;
  }
}

declare var ModbusRTU: ModbusRTU.IModbusRTU;
export = ModbusRTU ;
