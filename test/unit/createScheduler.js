const test = require('tape-promise/tape');
const sinon = require('sinon');
// const leakage = require('leakage');
const createScheduler = require('../../libs/createScheduler');

test('call order', async (t) => {
    const schedule = createScheduler();

    const p1 = {
        promise: sinon.stub().resolves('OK').named('p1.promise'),
        ok: sinon.stub().named('p1.ok'),
        fail: sinon.stub().named('p1.fail'),
    };
    const p2 = {
        promise: sinon.stub().rejects('FAIL').named('p2.promise'),
        ok: sinon.stub().named('p2.ok'),
        fail: sinon.stub().named('p2.fail'),
    };
    const p3 = {
        promise: sinon.stub().resolves('OK').named('p3.promise'),
        ok: sinon.stub().named('p3.ok'),
        fail: sinon.stub().named('p3.fail'),
    };

    schedule(p1.promise).then(p1.ok, p1.fail);
    schedule(p2.promise).then(p2.ok, p2.fail);
    await schedule(p3.promise).then(p3.ok, p3.fail);

    sinon.assert.callOrder(
        p1.promise,
        p1.ok,
        p2.promise,
        p2.fail,
        p3.promise,
        p3.ok,
    );

    t.pass('call order match');
});

// test('memory leak', async (t) => {
//     const schedule = createScheduler();
//
//     await leakage.iterate.async(async () => {
//         let last;
//         for (let i = 0; i < 10; i++) {
//             last = schedule(() => Promise.resolve());
//         }
//         await last;
//     });
//
//     t.pass('pass');
// });
