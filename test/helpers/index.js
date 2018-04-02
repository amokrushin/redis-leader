const RedisLeader = require('../../libs/RedisLeader');

const dummyError = new Error('Dummy error');
const noop = () => {};
const delay = (timeout = 0) => new Promise(resolve => setTimeout(resolve, timeout));
const getOptions = (options) => new RedisLeader(noop, options)._options;

const createTestLogger = (options = {}) => {
    const dispatchCalls = [];
    const { withNodeId = false } = options;
    return {
        info(...args) {
            if (args[0] === '[DISPATCH]') {
                dispatchCalls.push(withNodeId ? [args[1], args[2]] : args[2]);
            }
        },
        dispatchCalls,
    };
};

module.exports = {
    dummyError,
    noop,
    delay,
    getOptions,
    createTestLogger,
};
