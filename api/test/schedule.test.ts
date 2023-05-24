import test from 'tape';
import Schedule from '../lib/schedule.js';

test('Schedule#is_rate', async (t) => {
    try {
        t.notOk(Schedule.is_rate('cron(15 10 * * ? *)'));
        t.notOk(Schedule.is_rate('cron(0 18 ? * MON-FRI *)'));
        t.notOk(Schedule.is_rate('cron(0 8 1 * ? *)'));
        t.notOk(Schedule.is_rate('cron(0/10 * ? * MON-FRI *)'));
        t.notOk(Schedule.is_rate('cron(0/5 8-17 ? * MON-FRI *)'));
        t.notOk(Schedule.is_rate('cron(0 9 ? * 2#1 *)'));

        t.ok(Schedule.is_rate('rate(5 minutes)'));
        t.ok(Schedule.is_rate('rate(1 hour)'));
        t.ok(Schedule.is_rate('rate(7 days)'));
    } catch (err) {
        t.error(err);
    }

    t.end();
});

test('Schedule#is_cron', async (t) => {
    try {
        t.ok(Schedule.is_cron('cron(15 10 * * ? *)'));
        t.ok(Schedule.is_cron('cron(0 18 ? * MON-FRI *)'));
        t.ok(Schedule.is_cron('cron(0 8 1 * ? *)'));
        t.ok(Schedule.is_cron('cron(0/10 * ? * MON-FRI *)'));
        t.ok(Schedule.is_cron('cron(0/5 8-17 ? * MON-FRI *)'));
        t.ok(Schedule.is_cron('cron(0 9 ? * 2#1 *)'));

        t.notOk(Schedule.is_cron('rate(5 minutes)'));
        t.notOk(Schedule.is_cron('rate(1 hour)'));
        t.notOk(Schedule.is_cron('rate(7 days)'));
    } catch (err) {
        t.error(err);
    }

    t.end();
});

test('Schedule#parse_rate', async (t) => {
    try {
        t.ok(Schedule.parse_rate('cron(15 10 * * ? *)'));
        t.fail();
    } catch (err) {
        t.equals(err.message, 'Schedule is not a rate');
    }

    try {
        t.deepEquals(Schedule.parse_rate('rate(1 second)'), {
            unit: 'second',
            freq: 1
        });
        t.deepEquals(Schedule.parse_rate('rate(2 seconds)'), {
            unit: 'second',
            freq: 2
        });

        t.deepEquals(Schedule.parse_rate('rate(1 minute)'), {
            unit: 'minute',
            freq: 1
        });
        t.deepEquals(Schedule.parse_rate('rate(2 minutes)'), {
            unit: 'minute',
            freq: 2
        });

        t.deepEquals(Schedule.parse_rate('rate(1 hour)'), {
            unit: 'hour',
            freq: 1
        });
        t.deepEquals(Schedule.parse_rate('rate(2 hour)'), {
            unit: 'hour',
            freq: 2
        });

        t.deepEquals(Schedule.parse_rate('rate(1 day)'), {
            unit: 'day',
            freq: 1
        });
        t.deepEquals(Schedule.parse_rate('rate(2 day)'), {
            unit: 'day',
            freq: 2
        });
    } catch (err) {
        t.error(err);
    }
    t.end();
});

test('Schedule#is_aws', async (t) => {
    try {
        t.ok(Schedule.is_aws('cron(15 10 * * ? *)'));
        t.ok(Schedule.is_aws('cron(0 18 ? * MON-FRI *)'));
        t.ok(Schedule.is_aws('cron(0 8 1 * ? *)'));
        t.ok(Schedule.is_aws('cron(0/10 * ? * MON-FRI *)'));
        t.ok(Schedule.is_aws('cron(0/5 8-17 ? * MON-FRI *)'));
        t.ok(Schedule.is_aws('cron(0 9 ? * 2#1 *)'));

        t.ok(Schedule.is_aws('rate(5 minutes)'));
        t.ok(Schedule.is_aws('rate(1 hour)'));
        t.ok(Schedule.is_aws('rate(7 days)'));

        t.notOk(Schedule.is_aws('rate(1 second)'));
        t.notOk(Schedule.is_aws('rate(2 seconds)'));
    } catch (err) {
        t.error(err);
    }

    t.end();
});
