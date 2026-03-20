/**
 * `serialport` is an optional dependency. Some declarations import `serialport` modules; if it is
 * not installed (`npm install --no-optional`), TypeScript may not resolve those modules — use
 * `skipLibCheck` or add `serialport` as a devDependency. Runtime serial APIs are optional (README).
 */
import { ModbusRTU } from "./ModbusRTU";
export * from "./ServerTCP";
export * from "./ServerSerial";

export default ModbusRTU;