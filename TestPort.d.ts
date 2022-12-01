import {EventEmitter} from "events";
export class TestPort extends EventEmitter {
  isOpen: () => boolean;
  open: (callback: (...args: any[]) => any) => void;
  close: (callback: (...args: any[]) => any) => void;
  write:(data:Buffer)=>void;
}
