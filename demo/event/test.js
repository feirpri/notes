const assert = require('assert').strict;
const FEvent = require('./index.js');

function eventHandle() {
    return new Promise((resolve) => {
        setTimeout(() => resolve('ok'), 1000);
    });
}
const evt = new FEvent();
evt.$on('test', (...args) => [...args]);
evt.$on('test', eventHandle);

const a = () =>
    evt
        .$promiseEmit('test', 1, 2)
        .then(([fn1Res, fn2Res]) => {
            assert.deepStrictEqual(fn1Res, [1, 2]);
            assert.strictEqual(fn2Res, 'ok');
            console.log('测试 promiseEmit: Success!');
        })
        .catch(console.log);

const b = () => {
    evt.$off('test', eventHandle);
    return evt
        .$promiseEmit('test', 1, 2)
        .then((result) => {
            assert.strictEqual(result.length, 1);
            assert.deepStrictEqual(result[0], [1, 2]);
            console.log('测试 $off: Success!');
        })
        .catch(console.log);
};

const c = () => {
    evt.$off('test');
    evt.$promiseEmit('test', 1, 2)
        .then((result) => {
            assert.strictEqual(result.length, 0);
            console.log('测试 $off: Success!');
        })
        .catch(console.log);
};

// start
a()
    .then(b)
    .then(c);
