const assert = require('assert');
const FEvent = require('./index.js');

const evt = new FEvent();
evt.$on('test', (...args) => [...args]);
evt.$on('test', () => {
    return new Promise((resolve) => {
        setTimeout(() => resolve('ok'), 1000);
    });
});

evt.$promiseEmit('test', 1, 2).then(([fn1Res, fn2Res]) => {
    assert.deepStrictEqual([1, 2], fn1Res);
    assert.deepStrictEqual('ok', fn2Res);
    console.log('Success!');
}).catch(console.log);
