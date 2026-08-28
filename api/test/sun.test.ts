import test from 'node:test';
import assert from 'node:assert';
import { timezoneAt, localCivilDate, localCivilNoon, sunTimesAt, utcOffset } from '../stateless/lib/sun.js';

const NZ = { lat: -43.48239455544271, lon: 169.9446811687917 };
const CHATHAM = { lat: -43.95, lon: -176.55 };
const INVERCARGILL = { lat: -46.41, lon: 168.35 };
const KIRITIMATI = { lat: 1.87, lon: -157.4 };

function fmt(time: Date | null, timezone: string): string {
    assert.ok(time);
    return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hourCycle: 'h23',
        hour: '2-digit',
        minute: '2-digit',
    }).format(time);
}

test('timezoneAt - resolves known locations', () => {
    assert.equal(timezoneAt(NZ.lat, NZ.lon), 'Pacific/Auckland');
    assert.equal(timezoneAt(CHATHAM.lat, CHATHAM.lon), 'Pacific/Chatham');
    assert.equal(timezoneAt(39.7392, -104.9903), 'America/Denver');
});

test('timezoneAt - null on invalid input', () => {
    assert.equal(timezoneAt(NaN, 0), null);
    assert.equal(timezoneAt(91, 0), null);
    assert.equal(timezoneAt(0, 181), null);
});

test('utcOffset - resolves civil offsets including DST and non-hour zones', () => {
    assert.equal(utcOffset('Pacific/Auckland', new Date('2026-08-22T23:36Z')), 12 * 3600000);
    assert.equal(utcOffset('Pacific/Auckland', new Date('2026-01-14T23:00Z')), 13 * 3600000);
    assert.equal(utcOffset('Pacific/Chatham', new Date('2026-08-22T23:36Z')), 12.75 * 3600000);
    assert.equal(utcOffset('America/Los_Angeles', new Date('2026-08-22T23:36Z')), -7 * 3600000);
});

test('localCivilDate / localCivilNoon - reported scenario', () => {
    const now = new Date('2026-08-22T23:36Z');
    assert.deepEqual(localCivilDate('Pacific/Auckland', now), [2026, 7, 23]);
    assert.deepEqual(localCivilDate('America/Los_Angeles', now), [2026, 7, 22]);
    assert.equal(localCivilNoon('Pacific/Auckland', now).toISOString(), '2026-08-23T00:00:00.000Z');
});

test('sunTimesAt - reported scenario: correct local day rendered in NZST', () => {
    const now = new Date('2026-08-22T23:36Z');
    const tz = timezoneAt(NZ.lat, NZ.lon);
    const sun = sunTimesAt(NZ.lat, NZ.lon, 0, tz, now);

    assert.equal(sun.solarNoon?.toISOString().slice(0, 16), '2026-08-23T00:42');
    assert.equal(sun.sunrise?.toISOString().slice(0, 16), '2026-08-22T19:23');
    assert.equal(sun.sunset?.toISOString().slice(0, 16), '2026-08-23T06:03');

    assert.equal(fmt(sun.sunrise, tz!), '07:23');
    assert.equal(fmt(sun.solarNoon, tz!), '12:42');
    assert.equal(fmt(sun.sunset, tz!), '18:03');

    assert.ok(sun.sunset!.getTime() > now.getTime(), 'sunset is still ahead at 11:36 local');
    assert.ok(sun.sunrise!.getTime() < now.getTime(), 'sunrise is behind at 11:36 local');
});

test('sunTimesAt - civil day is respected across a whole local day', () => {
    const tz = 'Pacific/Auckland';
    // 2026-08-23 NZST runs 2026-08-22T12:00Z .. 2026-08-23T12:00Z
    for (const t of ['2026-08-22T12:05Z', '2026-08-22T18:00Z', '2026-08-23T05:00Z', '2026-08-23T11:55Z']) {
        const sun = sunTimesAt(NZ.lat, NZ.lon, 0, tz, new Date(t));
        assert.equal(sun.solarNoon?.toISOString().slice(0, 13), '2026-08-23T00', `queried at ${t}`);
    }

    const before = sunTimesAt(NZ.lat, NZ.lon, 0, tz, new Date('2026-08-22T11:55Z'));
    assert.equal(before.solarNoon?.toISOString().slice(0, 13), '2026-08-22T00');
});

test('sunTimesAt - NZDT (UTC+13): local noon sits on the previous UTC date', () => {
    const tz = 'Pacific/Auckland';
    const now = new Date('2026-01-14T22:00Z'); // 11:00 NZDT on 2026-01-15
    const sun = sunTimesAt(INVERCARGILL.lat, INVERCARGILL.lon, 0, tz, now);

    assert.equal(sun.solarNoon?.toISOString().slice(0, 13), '2026-01-15T00');
    assert.ok(sun.sunset!.getTime() > now.getTime());
    assert.ok(sun.sunrise!.getTime() < now.getTime());
    assert.equal(fmt(sun.sunrise, tz), '06:13');
});

test('sunTimesAt - Chatham Islands (UTC+12:45) resolve to their own day', () => {
    const tz = timezoneAt(CHATHAM.lat, CHATHAM.lon);
    assert.equal(tz, 'Pacific/Chatham');

    const now = new Date('2026-08-22T23:36Z'); // 12:21 on 2026-08-23 local
    const sun = sunTimesAt(CHATHAM.lat, CHATHAM.lon, 0, tz, now);

    assert.equal(sun.solarNoon?.toISOString().slice(0, 13), '2026-08-22T23');
    assert.ok(sun.sunset!.getTime() > now.getTime());
    assert.ok(sun.sunrise!.getTime() < now.getTime());
});

test('sunTimesAt - Kiritimati (UTC+14, 157W) civil day differs from the UTC day by a full day', () => {
    const tz = timezoneAt(KIRITIMATI.lat, KIRITIMATI.lon);
    assert.equal(tz, 'Pacific/Kiritimati');

    const now = new Date('2026-08-22T20:00Z'); // 10:00 on 2026-08-23 local
    const sun = sunTimesAt(KIRITIMATI.lat, KIRITIMATI.lon, 0, tz, now);

    assert.equal(sun.solarNoon?.toISOString().slice(0, 13), '2026-08-22T22');
    assert.ok(sun.sunset!.getTime() > now.getTime());
    assert.ok(sun.sunrise!.getTime() < now.getTime());
});

test('sunTimesAt - stable across the 2026-04-05 NZDT -> NZST transition', () => {
    const tz = 'Pacific/Auckland';
    // Transition at 2026-04-05T03:00 NZDT (2026-04-04T14:00Z)
    const before = sunTimesAt(NZ.lat, NZ.lon, 0, tz, new Date('2026-04-04T13:30Z'));
    const after = sunTimesAt(NZ.lat, NZ.lon, 0, tz, new Date('2026-04-04T14:30Z'));

    assert.equal(before.solarNoon?.toISOString().slice(0, 13), '2026-04-05T00');
    assert.equal(after.solarNoon?.toISOString().slice(0, 13), '2026-04-05T00');
});

test('sunTimesAt - no timezone falls back to the solar day rather than the UTC day', () => {
    const now = new Date('2026-08-22T23:36Z');
    const sun = sunTimesAt(NZ.lat, NZ.lon, 0, null, now);

    assert.equal(sun.solarNoon?.toISOString().slice(0, 13), '2026-08-23T00');
    assert.ok(sun.sunset!.getTime() > now.getTime());
});
