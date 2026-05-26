import EventEmitter from '@fefeding/eventemitter';

export const AUTHTIMEOUT = 'AUTHTIMEOUT';
export const TERMINAL_CONNECTED = 'TERMINAL_CONNECTED';
export const TERMINAL_DISCONNECTED = 'TERMINAL_DISCONNECTED';
export const TERMINAL_DATA = 'TERMINAL_DATA';

const GlobalEventBus = new EventEmitter();
const GlobalEventBusCache = new Map<string | symbol, any>();

export function subscribe(name: string | symbol, callback: any) {
    const id = typeof name === 'symbol' ? name : Symbol(name);
    GlobalEventBusCache.set(id, { name, callback });
    GlobalEventBus.on(name, callback);
    return id;
}

export function unsubscribe(eventId: string | symbol) {
    const event = GlobalEventBusCache.get(eventId);
    if (event) {
        GlobalEventBus.off(event.name, event.callback);
        GlobalEventBusCache.delete(eventId);
        return true;
    }
    return false;
}

export function publish(name: string | symbol, data?: any) {
    return GlobalEventBus.emit(name, data);
}
