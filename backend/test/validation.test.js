const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validDate, positiveId } = require('../src/utils/validation');
test('calendar validation rejects impossible and ambiguous dates', () => {
    for (const value of ['2026-02-29', '2026-04-31', '2026-13-01', '', null, '26-1-1']) assert.equal(validDate(value), false);
    for (const value of ['2024-02-29', '2026-10-26']) assert.equal(validDate(value), true);
});
test('record IDs must be whole positive safe integers', () => {
    for (const value of [0, -1, 1.5, '1 OR 1=1', '2abc', null, Number.MAX_SAFE_INTEGER + 1]) assert.equal(positiveId(value), false);
    for (const value of [1, '20']) assert.equal(positiveId(value), true);
});
