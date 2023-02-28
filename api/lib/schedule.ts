export interface ScheduleRate {
    unit: string;
    freq: number;
}

export default class Schedule {
    static is_rate(schedule: string): boolean {
        return schedule.trim().startsWith('rate(');
    }

    static is_cron(schedule: string): boolean {
        return schedule.trim().startsWith('cron(');
    }

    static parse_rate(schedule: string): ScheduleRate {
        if (!this.is_rate(schedule)) throw new Error('Schedule is not a rate');

        const schedules: string[] = schedule
            .trim()
            .replace(/^rate\(/, '')
            .replace(/\)$/, '')
            .trim()
            .split(' ');

        if (schedules.length !== 2) throw new Error('Rate expression is improperly formatted');

        const freq = parseInt(schedules[0]);
        if (isNaN(freq)) throw new Error('Rate expression must start with frequency integer');

        const unit = schedules[1].replace(/s$/, '');

        if (!['second', 'minute', 'hour', 'day'].includes(unit)) throw new Error('Unknown Unit');

        return { unit, freq };
    }

    static is_aws(schedule: string): boolean {
        if (this.is_cron(schedule)) return true;

        const parsed = this.parse_rate(schedule);

        if (parsed.unit === 'second') return false;

        return true;
    }
}
