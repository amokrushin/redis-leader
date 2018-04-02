const assert = require('assert');

const waitForEvent = (eventEmitter, event, options = {}) => new Promise((resolve) => {
    assert(typeof eventEmitter.on === 'function', 'eventEmitter.on must be a function');
    assert(typeof eventEmitter.once === 'function', 'eventEmitter.once must be a function');
    assert(typeof event === 'string', 'event must be a string');
    assert(typeof options === 'object', 'options must be an object');

    const { filter = null, timeout = 10000 } = options;
    if (filter) {
        assert(typeof filter === 'function', 'filter must be a function');
    }
    if (timeout) {
        assert(typeof timeout === 'number', 'timeout must be a number');
    }

    let timerId = null;

    function listener(...args) {
        if (filter && !filter(...args)) {
            return;
        }
        clearTimeout(timerId);
        eventEmitter.removeListener(event, listener);
        resolve();
    }

    if (timeout) {
        timerId = setTimeout(() => {
            throw new Error('Timed out');
        }, timeout);
    }

    eventEmitter.on(event, listener);
});

waitForEvent.race = (eventEmitters, event, filter = null) => new Promise((resolve) => {
    assert(typeof event === 'string', 'event must be a string');

    function listener(...args) {
        if (filter ? filter(...args) : true) {
            eventEmitters.forEach((eventEmitter) => {
                eventEmitter.removeListener(event, listener);
            });
            resolve();
        }
    }

    if (filter) {
        assert(typeof filter === 'function', 'filter must be a function');
    }

    eventEmitters.forEach((eventEmitter) => {
        eventEmitter.on(event, listener);
    });
});

const waitForNthEvent = (eventEmitter, event, n = 1) => new Promise((resolve) => {
    let counter = 0;

    function listener() {
        counter++;
        if (counter >= n) {
            eventEmitter.removeListener(event, listener);
            resolve();
        }
    }

    eventEmitter.on(event, listener);
});

function delay(timeout = 0) {
    return new Promise(resolve => setTimeout(resolve, timeout));
}

function nextTick() {
    return new Promise(resolve => process.nextTick(resolve));
}

module.exports = {
    delay,
    nextTick,
    waitForEvent,
    waitForNthEvent,
};
