const test = require('tape-promise/tape');
const assert = require('assert');
const Redis = require('ioredis');
const lua = require('../../libs/lua');
const { delay } = require('../helpers');

assert(process.env.NODE_ENV, 'test');

const redis = new Redis({
    host: process.env.REDIS_HOST,
    retryStrategy: () => false,
});

test('connect', (t) => {
    redis.once('connect', () => {
        t.pass('done');
        t.end();
    });
    redis.once('error', (err) => {
        console.error(err.message);
        process.exit(1);
    });
});


test('setup', async (t) => {
    await redis.flushdb();

    redis.defineCommand('pexpirenex', lua.pexpirenex);

    t.pass('done');
});

test('pexpirenex', async (t) => {
    await redis.set('foo', 'bar');

    t.equal(
        await redis.pexpirenex('foo', 1),
        1,
        'set ttl for key without ttl',
    );

    await delay(10);

    t.equal(
        await redis.pttl('foo'),
        -2,
        'ensure key expired',
    );

    t.equal(
        await redis.pexpirenex('bar', 1),
        0,
        'set ttl for not existing key',
    );

    await redis.set('foo', 'bar', 'PX', 60000);

    t.equal(
        await redis.pexpirenex('foo', 1),
        0,
        'set ttl for key with ttl',
    );

    t.ok(
        await redis.pttl('foo') > 1,
        'ensure key ttl not changed',
    );

    await redis.del('foo');
});

test('teardown', async (t) => {
    await redis.quit();
    t.pass('done');
});
