const assert = require('assert');

const waitForEvent = (eventEmitter, event, filter = null) => new Promise((resolve) => {
    assert(typeof eventEmitter.on === 'function', 'eventEmitter.on must be a function');
    assert(typeof eventEmitter.once === 'function', 'eventEmitter.once must be a function');
    assert(typeof event === 'string', 'event must be a string');

    function listener(...args) {
        if (filter(...args)) {
            eventEmitter.removeListener(event, listener);
            resolve();
        }
    }

    if (filter) {
        assert(typeof filter === 'function', 'filter must be a function');
        eventEmitter.on(event, listener);
    } else {
        eventEmitter.once(event, resolve);
    }
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
