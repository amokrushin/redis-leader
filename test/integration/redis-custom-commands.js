const test = require('tape-promise/tape');
const assert = require('assert');
const lua = require('../../libs/lua');
const { delay } = require('../helpers');
const createClient = require('../helpers/createClient');

assert(process.env.NODE_ENV, 'test');

const redis = createClient();

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
    redis.defineCommand('pexpireifeq', lua.pexpireifeq);

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

test('pexpireifeq', async (t) => {
    await redis.set('foo', 'bar');

    t.equal(
        await redis.pexpireifeq('foo', 'bar', 10000),
        1,
        'set ttl for key if value match',
    );

    t.ok(
        await redis.pttl('foo') > 0,
        'ensure ttl set',
    );

    t.equal(
        await redis.pexpireifeq('foo', 'baz', 10000),
        0,
        'set ttl for key if value not match',
    );

    t.equal(
        await redis.pexpireifeq('foobar', 'baz', 10000),
        0,
        'set ttl for not existing key',
    );

    await redis.del('foo');
});

test('teardown', async (t) => {
    await redis.quit();
    t.pass('done');
});
