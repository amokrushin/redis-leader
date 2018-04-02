const test = require('tape-promise/tape');
const RedisLeader = require('../../../libs/RedisLeader');
const redisStub = require('../../helpers/redisStub');
const { createTestLogger } = require('../../helpers');


test('schedule start->stop as leader'.toUpperCase(), async (t) => {
    const logger = createTestLogger();
    const options = { autostart: false, keyPrefix: '', logger };
    const redisLeader = new RedisLeader(redisStub.leader, options);
    redisLeader.start();
    await redisLeader.stop();

    t.deepEqual(
        logger.dispatchCalls,
        [
            'START',
            'SET_REDIS_CLIENT',
            'SET_NODE_ID',
            'SWITCH_ROLE',
            'START_KEEPALIVE',
            'STOP',
            'SWITCH_ROLE',
            'STOP_KEEPALIVE',
            'SET_REDIS_CLIENT',
        ],
        'dispatch calls have correct order',
    );
});

test('schedule start->stop as worker'.toUpperCase(), async (t) => {
    const logger = createTestLogger();
    const options = { autostart: false, keyPrefix: '', logger };
    const redisLeader = new RedisLeader(redisStub.worker, options);
    redisLeader.start();
    await redisLeader.stop();

    t.deepEqual(
        logger.dispatchCalls,
        [
            'START',
            'SET_REDIS_CLIENT',
            'SET_NODE_ID',
            'SWITCH_ROLE',
            'START_WATCHDOG',
            'STOP',
            'SWITCH_ROLE',
            'STOP_WATCHDOG',
            'SET_REDIS_CLIENT',
        ],
        'dispatch calls have correct order',
    );
});
