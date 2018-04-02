const test = require('tape-promise/tape');
const Redis = require('ioredis');
const RedisLeader = require('../../libs/RedisLeader');
const { waitForEvent } = require('../helpers/async-utils');
const { delay } = require('../helpers');

const createClient = () => new Redis({
    host: process.env.REDIS_HOST,
    retryStrategy: () => false,
});

const countNodesByState = (nodes) => {
    let inactive = 0;
    let leader = 0;
    let worker = 0;
    for (let node of nodes) {
        if (node.isLeader() === null) {
            inactive++;
        }
        if (node.isLeader() === true) {
            leader++;
        }
        if (node.isLeader() === false) {
            worker++;
        }
    }
    return { inactive, leader, worker };
};

async function waitForKeepalive() {
    const pubsub = createClient();
    const leaderKeepaliveChannel = '__redis-leader_keepalive__';
    pubsub.subscribe(leaderKeepaliveChannel);
    await waitForEvent(pubsub, 'message', (channel) => (channel === leaderKeepaliveChannel));
    pubsub.unsubscribe(leaderKeepaliveChannel);
    pubsub.quit();
}

test('single node start/stop'.toUpperCase(), async (t) => {
    const node = new RedisLeader(createClient, {
        failoverTimeout: 100,
    });

    await waitForEvent(node, 'switch-role');

    t.equal(node.isLeader(), true, 'single node is leader');

    await waitForKeepalive();

    node.stop();

    await delay(100);
});

test('two nodes start/stop'.toUpperCase(), async (t) => {
    const options = {
        failoverTimeout: 100,
    };
    const leader = new RedisLeader(createClient, options);
    await waitForEvent(leader, 'switch-role');

    await delay(20);

    const worker = new RedisLeader(createClient, options);
    await waitForEvent(worker, 'switch-role');

    t.equal(leader.isLeader(), true, 'leader node is leader');
    t.equal(worker.isLeader(), false, 'worker node is not leader');

    await waitForKeepalive();

    leader.stop();
    worker.stop();

    await delay(options.failoverTimeout);
});

/*
 *  Number of nodes
 */
const N = 3;

test(`${N} nodes switch leader`.toUpperCase(), async (t) => {
    const options = {
        failoverTimeout: 200,
        // logger: console,
    };
    let counter;

    // ------------------------------------------------ //
    t.comment(`- create ${N} nodes`);
    const nodes = Array.from({ length: N }).map(() => new RedisLeader(createClient, options));
    t.pass(`${N} nodes created`);

    await Promise.all(nodes.map(node => waitForEvent(node, 'switch-role')));
    t.pass(`${N} nodes had emitted "switch-role" event`);

    counter = countNodesByState(nodes);
    t.equal(counter.inactive, 0, `inactive: ${counter.inactive}`);
    t.equal(counter.leader, 1, `leader: ${counter.leader}`);
    t.equal(counter.worker, N - 1, `workers: ${counter.worker}`);


    // ------------------------------------------------ //
    t.comment('- kill leader');
    const leader = nodes.find(node => node.isLeader());
    await leader.stop();

    counter = countNodesByState(nodes);
    t.equal(counter.inactive, 1, `inactive: ${counter.inactive}`);
    t.equal(counter.leader, 0, `leader: ${counter.leader}`);
    t.equal(counter.worker, N - 1, `workers: ${counter.worker}`);


    // ------------------------------------------------ //
    t.comment('- wait for new leader');

    // console.time('timeout');
    await waitForEvent.race(nodes, 'switch-role');
    // console.timeEnd('timeout');

    counter = countNodesByState(nodes);
    t.equal(counter.inactive, 1, `inactive: ${counter.inactive}`);
    t.equal(counter.leader, 1, `leader: ${counter.leader}`);
    t.equal(counter.worker, N - 2, `workers: ${counter.worker}`);

    await delay(options.failoverTimeout * 2);


    // ------------------------------------------------ //
    t.comment('- stop all nodes');
    await Promise.all(nodes.map(node => node.stop()));
    t.pass(`${N} nodes stopped`);

    await delay(options.failoverTimeout);
});
