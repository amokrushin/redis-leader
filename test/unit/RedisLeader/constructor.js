const test = require('tape-promise/tape');
const sinon = require('sinon');
const EventEmitter = require('events');
const RedisLeader = require('../../../libs/RedisLeader');
const { getOptions, noop } = require('../../helpers');

test('statics', (t) => {
    t.equal(typeof RedisLeader, 'function', 'is function');
    t.equal(RedisLeader.name, 'RedisLeader', 'name match');
    t.equal(typeof RedisLeader.defaultOptions, 'object', 'defaultOptions is object');
    t.ok(EventEmitter.isPrototypeOf(RedisLeader), 'extends EventEmitter');

    t.end();
});

test('public methods', (t) => {
    const { prototype } = RedisLeader;
    t.equal(typeof prototype.start, 'function', '#start is function');
    t.equal(typeof prototype.stop, 'function', '#stop is function');
    t.equal(typeof prototype.nodeId, 'function', '#nodeId is function');
    t.equal(typeof prototype.isLeader, 'function', '#isLeader is function');

    const nodeId = Symbol('nodeId');
    t.equal(
        prototype.nodeId.call({
            _getState: () => ({ nodeId }),
        }),
        nodeId,
        '#nodeId returns internal state value',
    );

    const isLeader = Symbol('isLeader');
    t.equal(
        prototype.isLeader.call({
            _getState: () => ({ isLeader }),
        }),
        isLeader,
        '#isLeader returns internal state value',
    );

    t.end();
});

test('options.failoverTimeout', (t) => {
    const start = sinon.stub(RedisLeader.prototype, 'start').returns(Promise.resolve());

    t.equal(getOptions({}).failoverTimeout, RedisLeader.defaultOptions.failoverTimeout, 'default failoverTimeout');
    t.equal(getOptions({ failoverTimeout: 2000 }).failoverTimeout, 2000, 'set failoverTimeout');

    start.restore();
    t.end();
});

test('options.autostart = false', async (t) => {
    const start = sinon.stub(RedisLeader.prototype, 'start').returns(Promise.resolve());

    new RedisLeader(noop, { autostart: false });
    t.ok(start.notCalled, 'start not called');

    start.restore();
    t.end();
});

test('options.autostart = true', async (t) => {
    const start = sinon.stub(RedisLeader.prototype, 'start').returns(Promise.resolve());

    new RedisLeader(noop, { autostart: true });
    t.ok(start.called, 'start called');

    start.restore();
    t.end();
});

test('initial state', (t) => {
    const start = sinon.stub(RedisLeader.prototype, 'start').returns(Promise.resolve());

    const state = new RedisLeader(noop)._state;

    t.equal(state.nodeId, null, 'nodeId is null');
    t.equal(state.isLeader, null, 'isLeader is null');
    t.equal(state.heartbeatTimerId, null, 'heartbeatTimerId is null');
    t.equal(state.redisClient, null, 'heartbeatTimerId is null');
    t.equal(state.pubsubClient, null, 'pubsubClient is null');
    t.equal(state.watchdog, null, 'watchdog is null');

    start.restore();
    t.end();
});
