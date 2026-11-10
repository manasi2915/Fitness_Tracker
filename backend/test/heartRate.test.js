const test = require('node:test');
const assert = require('node:assert/strict');
const { heartRateLimits, classifyReading, ageOn } = require('../src/utils/heartRate');

const now = new Date('2026-11-05T12:00:00Z');

test('age is computed from the date of birth, before and after the birthday', () => {
    assert.equal(ageOn('1995-04-12', now), 31);
    assert.equal(ageOn('1995-12-01', now), 30);
    assert.equal(ageOn('not-a-date', now), null);
});

test('limits use 220 - age, and a default age when no date of birth is stored', () => {
    const known = heartRateLimits('1996-01-01', now);
    assert.deepEqual([known.age, known.age_known, known.max_heart_rate, known.high_threshold], [30, true, 190, 162]);
    const unknown = heartRateLimits(null, now);
    assert.equal(unknown.age_known, false);
    assert.equal(unknown.max_heart_rate, 190);
});

test('readings are classified as high, elevated at rest, low or normal', () => {
    const limits = heartRateLimits('1996-01-01', now);
    assert.equal(classifyReading({ heart_rate: '165', activity_state: 'exercising' }, limits), 'high');
    assert.equal(classifyReading({ heart_rate: '150', activity_state: 'exercising' }, limits), null);
    assert.equal(classifyReading({ heart_rate: '110', activity_state: 'resting' }, limits), 'elevated_resting');
    assert.equal(classifyReading({ heart_rate: '110', activity_state: 'walking' }, limits), null);
    assert.equal(classifyReading({ heart_rate: '35', activity_state: 'resting' }, limits), 'low');
    assert.equal(classifyReading({ heart_rate: 'x', activity_state: 'resting' }, limits), null);
});
