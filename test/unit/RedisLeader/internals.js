const test = require('tape-promise/tape');
const sinon = require('sinon');
const RedisLeader = require('../../../libs/RedisLeader');

test('_setState (immutable state update)', (t) => {
    const { _setState } = RedisLeader.prototype;

    const state = { foo: 'bar', ref: Symbol('ref') };
    const patch = { foo: 'baz' };
    const nextState = Object.assign({}, state, patch);
    const context = { _state: state };

    _setState.call(context, patch);

    t.notEqual(context._state, state);
    t.deepEqual(context._state, nextState);

    t.end();
});

test('_requestNodeId', (t) => {
    const { _requestNodeId } = RedisLeader.prototype;

    const redisClient = {
        incr: sinon.spy(),
    };
    const keyNodeIdSeq = 'foo';
    const context = {
        _options: { keyNodeIdSeq },
        _state: { redisClient },
        _getState: () => context._state,
    };

    _requestNodeId.call(context);

    t.ok(redisClient.incr.calledOnce, 'redisClient.incr called once');
    t.ok(redisClient.incr.calledWithExactly(keyNodeIdSeq), 'redisClient.incr args match');

    t.end();
});

test('_requestIsLeader', async (t) => {
    const { _requestIsLeader } = RedisLeader.prototype;

    const redisClient = {
        set: sinon.stub().resolves('OK'),
    };
    const nodeId = 'foo';
    const keyNodeLeaderId = 'bar';
    const failoverTimeout = 42;
    const context = {
        _options: { keyNodeLeaderId, failoverTimeout },
        _state: { nodeId, redisClient },
        _getState: () => context._state,
    };

    const ret = _requestIsLeader.call(context);

    const expectedArgs = [keyNodeLeaderId, nodeId, 'px', failoverTimeout, 'nx'];
    t.ok(redisClient.set.calledOnce, 'redisClient.set called once');
    t.ok(redisClient.set.calledWithExactly(...expectedArgs), 'redisClient.set args match');

    t.ok(ret instanceof Promise, 'returned value is promise');
    t.equal(typeof await ret, 'boolean', 'resolved with boolean');

    t.end();
});
