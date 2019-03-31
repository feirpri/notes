const instanceMap = new WeakMap();

function getInstanceListeners(ins, eventName) {
    let listenersHash = instanceMap.get(ins);
    if (!listenersHash) {
        listenersHash = {};
        instanceMap.set(ins, listenersHash);
    }
    if (!listenersHash[eventName]) {
        listenersHash[eventName] = [];
    }
    return listenersHash[eventName];
}

module.exports = class FEvent {
    $on(eventName, handler) {
        const events = getInstanceListeners(this, eventName);
        events.push(handler);
        return this;
    }

    $off(eventName, handler) {
        const events = getInstanceListeners(this, eventName);
        if (!handler) {
            events.length = 0;
            return this;
        }
        let i = events.length;
        while (i) {
            i -= 1;
            if (events[i] === handler) {
                events.splice(i, 1);
            }
        }
        return this;
    }

    $emit(eventName, ...args) {
        const eventData = new FEventData([...args]);
        const events = getInstanceListeners(this, eventName);
        events.forEach((handler) => handler.apply(this, [...args]));
        return this;
    }

    $promiseEmit(eventName, ...args) {
        const events = getInstanceListeners(this, eventName);
        const defers = events.map(
            async (handler) => await handler.apply(this, [...args]),
        );
        return Promise.all(defers);
    }
}
