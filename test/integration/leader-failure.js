const test = require('tape-promise/tape');
const Redis = require('ioredis');
const RedisLeader = require('../../libs/RedisLeader');
const { waitForEvent } = require('../helpers/async-utils');
const { delay, createTestLogger } = require('../helpers');

const createClient = () => new Redis({
    host: process.env.REDIS_HOST,
    retryStrategy: () => false,
});

function dropLeaderKey() {
    const redis = createClient();
    const { keyPrefix, keyNodeLeaderId } = RedisLeader.defaultOptions;
    const key = [keyPrefix, keyNodeLeaderId].filter(v => v).join(':');
    redis.del(key);
    redis.quit();
}

test('switch role on the fly'.toUpperCase(), async (t) => {
    const failoverTimeout = 500;
    const logger = createTestLogger({ withNodeId: true });
    const nodeA = new RedisLeader(createClient, { failoverTimeout, logger });
    await waitForEvent(nodeA, 'switch-role');

    await delay(20);

    const nodeB = new RedisLeader(createClient, { failoverTimeout, logger });
    await waitForEvent(nodeB, 'switch-role');

    t.comment('- initial state');
    t.equal(nodeA.isLeader(), true, 'nodeA is leader');
    t.equal(nodeB.isLeader(), false, 'nodeB is worker');

    /*
     * simulate failure
     */
    t.comment('- simulate failure (by deleting redis key)');
    dropLeaderKey();

    await Promise.all([
        waitForEvent(nodeA, 'switch-role'),
        waitForEvent(nodeB, 'switch-role'),
    ]);

    t.comment('- after both nodes emitted "switch-role" event');
    t.equal(nodeA.isLeader(), null, 'nodeA is out');
    t.equal(nodeB.isLeader(), true, 'nodeB is leader');

    await waitForEvent(nodeA, 'switch-role');

    t.comment('- after nodeA emitted "switch-role" event');
    t.equal(nodeA.isLeader(), false, 'nodeA is worker');

    await Promise.all([
        nodeA.stop(),
        nodeB.stop(),
    ]);

    t.comment('- validate dispatch calls');
    const idA = nodeA.nodeId();
    const idB = nodeB.nodeId();

    t.deepEqual(
        logger.dispatchCalls,
        [
            // start nodeA and wait for "switch-role" event
            [null, 'START'],
            [null, 'SET_REDIS_CLIENT'],
            [idA, 'SET_NODE_ID'],
            [idA, 'SWITCH_ROLE'],
            [idA, 'START_KEEPALIVE'],

            // start nodeB and wait for "switch-role" event
            [null, 'START'],
            [null, 'SET_REDIS_CLIENT'],
            [idB, 'SET_NODE_ID'],
            [idB, 'SWITCH_ROLE'],
            [idB, 'START_WATCHDOG'],

            /* simulate failure */

            // keepalive failure triggered on nodeA
            [idA, 'KEEPALIVE_FAILURE'],
            [idA, 'STOP'],
            [idA, 'SWITCH_ROLE'],
            [idA, 'STOP_KEEPALIVE'],
            [idA, 'SET_REDIS_CLIENT'],

            // watchdog triggered on nodeB
            [idB, 'WATCHDOG_TRIGGER'],
            [idB, 'SWITCH_ROLE'],
            [idB, 'STOP_WATCHDOG'],
            [idB, 'START_KEEPALIVE'],

            // nodeA starts after timeout
            [idA, 'START'],
            [idA, 'SET_REDIS_CLIENT'],
            [idA, 'SWITCH_ROLE'],
            [idA, 'START_WATCHDOG'],

            // stop
            [idA, 'STOP'],
            [idA, 'SWITCH_ROLE'],
            [idA, 'STOP_WATCHDOG'],
            [idB, 'STOP'],
            [idB, 'SWITCH_ROLE'],
            [idB, 'STOP_KEEPALIVE'],
            [idA, 'SET_REDIS_CLIENT'],
            [idB, 'SET_REDIS_CLIENT'],
        ],
        'dispatch calls have correct order',
    );

    await delay(failoverTimeout);
});
