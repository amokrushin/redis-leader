module.exports = [
    'START',
    'STOP',
    'SET_REDIS_CLIENT',
    'SET_NODE_ID',
    'SWITCH_ROLE',
    'START_WATCHDOG',
    'STOP_WATCHDOG',
    'START_KEEPALIVE',
    'STOP_KEEPALIVE',
    'SET_KEEPALIVE_TIMER',
    'WATCHDOG_TRIGGER',
].reduce((acc, event) => Object.assign(acc, { [event]: event }), {});
