module.exports = [
    'START',
    'STOP',
    'SET_REDIS_CLIENT',
    'SET_NODE_ID',
    'SWITCH_ROLE',
    'START_WATCHDOG',
    'STOP_WATCHDOG',
    'START_HEARTBEAT',
    'STOP_HEARTBEAT',
    'SET_HEARTBEAT_TIMER',
    'WATCHDOG_TRIGGER',
    'HEARTBEAT_FAILURE',
].reduce((acc, event) => Object.assign(acc, { [event]: event }), {});
