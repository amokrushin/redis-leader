const sinon = require('sinon');
const Redis = require('ioredis');
const RedisLeader = require('../../libs/RedisLeader');
const { dummyError } = require('.');

const leader = () => {
    const { keyNodeIdSeq, keyNodeLeaderId } = RedisLeader.defaultOptions;
    const nodeId = '123';

    const redisStub = sinon.createStubInstance(Redis);

    redisStub.incr.withArgs(keyNodeIdSeq).resolves(nodeId);
    redisStub.set.withArgs(keyNodeLeaderId, nodeId).resolves('OK');

    return redisStub;
};

const worker = () => {
    const { keyNodeIdSeq, keyNodeLeaderId } = RedisLeader.defaultOptions;
    const nodeId = '123';

    const redisStub = sinon.createStubInstance(Redis);

    redisStub.incr.withArgs(keyNodeIdSeq).resolves(nodeId);
    redisStub.set.withArgs(keyNodeLeaderId, nodeId).resolves(null);

    return redisStub;
};

const errorOnIncr = () => {
    const redisStub = sinon.createStubInstance(Redis);

    redisStub.incr.rejects(dummyError);
    redisStub.set.resolves(null);

    return redisStub;
};

module.exports = {
    leader,
    worker,
    errorOnIncr,
};
