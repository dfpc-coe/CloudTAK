import { describe, it, expect } from 'vitest';
import {
    parseRate,
    serializeRate,
    cronExpression,
    serializeCron,
    validateSchedule,
    describeSchedule,
} from './schedule.ts';

describe('parseRate', () => {
    it('parses valid rates', () => {
        expect(parseRate('rate(5 minutes)')).toEqual({ freq: 5, unit: 'minute' });
        expect(parseRate('rate(1 minute)')).toEqual({ freq: 1, unit: 'minute' });
        expect(parseRate('rate(30 seconds)')).toEqual({ freq: 30, unit: 'second' });
        expect(parseRate('rate(1 day)')).toEqual({ freq: 1, unit: 'day' });
    });

    it('rejects invalid rates', () => {
        expect(parseRate('rate(1 minutes)')).toBeNull();
        expect(parseRate('rate(5 minute)')).toBeNull();
        expect(parseRate('rate(0 minutes)')).toBeNull();
        expect(parseRate('rate(5 fortnights)')).toBeNull();
        expect(parseRate('rate(minutes)')).toBeNull();
        expect(parseRate('cron(0/15 * * * ? *)')).toBeNull();
    });
});

describe('serializeRate', () => {
    it('applies AWS pluralization rules', () => {
        expect(serializeRate({ freq: 1, unit: 'minute' })).toBe('rate(1 minute)');
        expect(serializeRate({ freq: 5, unit: 'minute' })).toBe('rate(5 minutes)');
        expect(serializeRate({ freq: 30, unit: 'second' })).toBe('rate(30 seconds)');
    });
});

describe('cron helpers', () => {
    it('round trips cron expressions', () => {
        expect(cronExpression('cron(0/15 * * * ? *)')).toBe('0/15 * * * ? *');
        expect(serializeCron('0/15 * * * ? *')).toBe('cron(0/15 * * * ? *)');
    });
});

describe('validateSchedule', () => {
    it('accepts valid schedules', () => {
        expect(validateSchedule('rate(5 minutes)')).toBeNull();
        expect(validateSchedule('cron(0/15 * * * ? *)')).toBeNull();
        expect(validateSchedule('cron(0/5 8-17 ? * MON-FRI *)')).toBeNull();
    });

    it('rejects invalid schedules with an error message', () => {
        expect(validateSchedule('')).toContain('empty');
        expect(validateSchedule(null)).toContain('empty');
        expect(validateSchedule('0/15 * * * ? *')).toContain('rate(...) or cron(...)');
        expect(validateSchedule('cron(* * * * *)')).toContain('6 fields');
        expect(validateSchedule('cron(1 2 3 4 5 6)')).toContain('?');
        expect(validateSchedule('rate(1 minutes)')).toContain('rate(<frequency>');
    });
});

describe('describeSchedule', () => {
    it('describes valid schedules', () => {
        expect(describeSchedule('rate(1 minute)')).toBe('Runs once every minute');
        expect(describeSchedule('rate(5 minutes)')).toBe('Runs once every 5 minutes');
        expect(describeSchedule('cron(0/15 * * * ? *)')).toBe('Every 15 minutes');
        expect(describeSchedule('cron(15 10 * * ? *)')).toBe('At 10:15 AM');
    });

    it('returns an empty string for invalid schedules', () => {
        expect(describeSchedule('rate(0 minutes)')).toBe('');
        expect(describeSchedule('')).toBe('');
        expect(describeSchedule(null)).toBe('');
    });
});
