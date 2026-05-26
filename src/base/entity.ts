import EventEmitter from '@fefeding/eventemitter';

export interface CallBack {
    (...args: any[]): any;
}

export interface WatchCallBack {
    (newValue: Record<string, any>, oldValue: Record<string, any>, key: string): void;
}

export default class Entity<T> extends EventEmitter {
    state: T;

    constructor(data?: T) {
        super();
        this.state = new Proxy<any>((data || {}) as unknown as T, {
            set: (oTarget: any, sKey, vValue) => {
                if (oTarget[sKey] !== vValue) {
                    const oldValue = { ...oTarget };
                    oTarget[sKey] = vValue;
                    this.emit('update', { ...oTarget }, oldValue, sKey);
                }
                return true;
            },
        });
    }

    watch(cb: WatchCallBack): CallBack {
        this.on('update', cb);
        return () => this.off('update', cb);
    }
}
