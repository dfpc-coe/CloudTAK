import { describe, it, expect } from 'vitest';
import { serializeWorkerBootConfig, parseWorkerBootConfig } from '../utils/worker-boot.ts';

describe('worker boot config', () => {
    it('round-trips the server URL through Worker.name', () => {
        const name = serializeWorkerBootConfig({ serverUrl: 'https://map.example.gov' });

        expect(parseWorkerBootConfig(name)).toEqual({ serverUrl: 'https://map.example.gov' });
    });

    it('ignores names it did not write', () => {
        expect(parseWorkerBootConfig(undefined)).toBeUndefined();
        expect(parseWorkerBootConfig(null)).toBeUndefined();
        expect(parseWorkerBootConfig('')).toBeUndefined();
        expect(parseWorkerBootConfig('atlas')).toBeUndefined();
        expect(parseWorkerBootConfig('cloudtak:not json')).toBeUndefined();
        expect(parseWorkerBootConfig('cloudtak:null')).toBeUndefined();
    });

    it('drops an empty or non-string serverUrl', () => {
        expect(parseWorkerBootConfig('cloudtak:{"serverUrl":""}')).toEqual({ serverUrl: undefined });
        expect(parseWorkerBootConfig('cloudtak:{"serverUrl":5}')).toEqual({ serverUrl: undefined });
        expect(parseWorkerBootConfig('cloudtak:{}')).toEqual({ serverUrl: undefined });
    });
});
