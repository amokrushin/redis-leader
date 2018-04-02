/* eslint-disable no-new */
const test = require('tape-promise/tape');
const sinon = require('sinon');
const RedisLeader = require('../../../libs/RedisLeader');
const {
    START,
} = require('../../../libs/events');

const dummyError = new Error('Dummy error');

test('error on autostart'.toUpperCase(), (t) => {
    const _dispatch = sinon.stub(RedisLeader.prototype, '_dispatch');

    _dispatch.withArgs(START).throws(dummyError);

    const redisLeader = new RedisLeader(() => {}, { autostart: true });

    redisLeader.on('error', (err) => {
        t.equal(err, dummyError, 'error caught');
        _dispatch.restore();
        t.end();
    });
});

test('error on start'.toUpperCase(), (t) => {
    const _dispatch = sinon.stub(RedisLeader.prototype, '_dispatch');

    _dispatch.withArgs(START).throws(dummyError);

    const redisLeader = new RedisLeader(() => {}, { autostart: false });

    redisLeader.start().catch((err) => {
        t.equal(err, dummyError, 'error caught');
        _dispatch.restore();
        t.end();
    });
});
