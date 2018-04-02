const RedisLeader = require('../../libs/RedisLeader');

const noop = () => {};
const delay = (timeout = 0) => new Promise(resolve => setTimeout(resolve, timeout));
const getOptions = (options) => new RedisLeader(noop, options)._options;

module.exports = {
    noop,
    delay,
    getOptions,
};
