import * as SunCalc from 'suncalc';
import type { SunTimes } from 'suncalc';
import tzlookup from '@photostructure/tz-lookup';

const HOUR = 3600000;
const DAY = 86400000;

export function timezoneAt(latitude: number, longitude: number): string | null {
    try {
        return tzlookup(latitude, longitude) || null;
    } catch {
        return null;
    }
}

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

function offsetFormatter(timezone: string): Intl.DateTimeFormat {
    let formatter = offsetFormatters.get(timezone);

    if (!formatter) {
        formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hourCycle: 'h23',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
        });

        offsetFormatters.set(timezone, formatter);
    }

    return formatter;
}

/**
 * UTC offset (ms) of the timezone at the given instant
 */
export function utcOffset(timezone: string, instant: Date): number {
    const parts: Record<string, number> = {};

    for (const part of offsetFormatter(timezone).formatToParts(instant)) {
        if (part.type !== 'literal') parts[part.type] = Number(part.value);
    }

    const asUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const seconds = instant.getTime() - (instant.getTime() % 1000);

    return asUTC - seconds;
}

export function localCivilDate(timezone: string, now: Date): [number, number, number] {
    const local = new Date(now.getTime() + utcOffset(timezone, now));

    return [local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()];
}

/**
 * The instant of 12:00 local time on the civil day containing `now` at the timezone.
 * The offset is resolved twice as the day's noon may sit on the other side of a DST transition from `now`.
 */
export function localCivilNoon(timezone: string, now: Date): Date {
    const [year, month, day] = localCivilDate(timezone, now);
    const naive = Date.UTC(year, month, day, 12);

    const provisional = naive - utcOffset(timezone, now);

    return new Date(naive - utcOffset(timezone, new Date(provisional)));
}

/**
 * Sun times for the civil day containing `now` at the queried location.
 *
 * SunCalc selects the solar day nearest to UTC noon of the UTC calendar date of the instant it is handed,
 * so it is anchored on the mean solar noon closest to the location's civil noon (or to `now` when the
 * timezone is unknown) rather than on `now` or on civil noon directly - either of which lands on the
 * wrong UTC date for zones far from their mean solar time (NZDT, Chatham, Kiritimati).
 */
export function sunTimesAt(
    latitude: number,
    longitude: number,
    altitude: number,
    timezone: string | null,
    now: Date = new Date(),
): SunTimes {
    const target = timezone ? localCivilNoon(timezone, now).getTime() : now.getTime();

    const solarNoonOfUTCDay = 12 * HOUR - (longitude / 15) * HOUR;

    let anchor = Math.floor(target / DAY) * DAY + solarNoonOfUTCDay;
    if (anchor - target > DAY / 2) anchor -= DAY;
    else if (target - anchor > DAY / 2) anchor += DAY;

    let times = SunCalc.getTimes(new Date(anchor), latitude, longitude, altitude);

    const drift = times.solarNoon ? times.solarNoon.getTime() - anchor : 0;
    if (Math.abs(drift) > DAY / 2) {
        times = SunCalc.getTimes(new Date(anchor - Math.sign(drift) * DAY), latitude, longitude, altitude);
    }

    return times;
}
