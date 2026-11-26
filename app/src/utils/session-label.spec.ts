import { describe, expect, it } from 'vitest';

import { labelFromUserAgent } from './session-label.ts';

describe('labelFromUserAgent', () => {
    it('names the Android model for the native app', () => {
        const ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UD1A.230803.041; wv) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36';
        expect(labelFromUserAgent(ua, true)).toBe('Pixel 8 (app)');
        expect(labelFromUserAgent('Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36', true)).toBe('SM-S918B (app)');
    });

    it('falls back when Android hides the model', () => {
        const ua = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36';
        expect(labelFromUserAgent(ua, true)).toBe('Android (app)');
    });

    it('names iPhone and iPad for the native app', () => {
        expect(labelFromUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)', true)).toBe('iPhone (app)');
        expect(labelFromUserAgent('Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X)', true)).toBe('iPad (app)');
    });

    it('names the browser and system on the web', () => {
        expect(labelFromUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36', false)).toBe('Chrome on Windows');
        expect(labelFromUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36 Edg/126.0', false)).toBe('Edge on Windows');
        expect(labelFromUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15', false)).toBe('Safari on macOS');
        expect(labelFromUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0', false)).toBe('Firefox on Linux');
    });

    it('still returns something for an unknown agent', () => {
        expect(labelFromUserAgent('', false)).toBe('Browser');
        expect(labelFromUserAgent('', true)).toBe('CloudTAK app');
    });
});
