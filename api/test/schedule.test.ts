import test from 'node:test';
import assert from 'node:assert';
import Schedule from '../lib/schedule.js';

// Tests if the intent is Rate - not if the rate is valid
test('Schedule.is_rate()', async () => {
    assert.ok(Schedule.is_rate('rate(1 hour)'))
    assert.ok(Schedule.is_rate('rate(2 hour)'))
    assert.ok(!Schedule.is_rate('cron(2 hour)'))
});

// Tests if the intent is cron - not if the cron is valid
test('Schedule.is_cron()', async () => {
    assert.ok(Schedule.is_cron('cron(1 hour)'))
    assert.ok(!Schedule.is_cron('rate(1 hour)'))
});

test('Schedule.parse_rate()', async () => {
    assert.throws(() => {
        Schedule.parse_rate('rate(1 seconds)');
    }, /A frequency value of 1/);

    assert.throws(() => {
        Schedule.parse_rate('rate(1 minutes)');
    }, /A frequency value of 1/);

    assert.throws(() => {
        Schedule.parse_rate('rate(1 hours)');
    }, /A frequency value of 1/);

    assert.throws(() => {
        Schedule.parse_rate('rate(1 days)');
    }, /A frequency value of 1/);

    assert.throws(() => {
        Schedule.parse_rate('rate(2 second)');
    }, /A frequency value of >1/);

    assert.throws(() => {
        Schedule.parse_rate('rate(2 minute)');
    }, /A frequency value of >1/);

    assert.throws(() => {
        Schedule.parse_rate('rate(2 hour)');
    }, /A frequency value of >1/);

    assert.throws(() => {
        Schedule.parse_rate('rate(2 day)');
    }, /A frequency value of >1/);
});
