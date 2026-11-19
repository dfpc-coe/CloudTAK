import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(), getLaunchUrl: vi.fn() } }));
vi.mock('@capacitor/browser', () => ({ Browser: { open: vi.fn(), close: vi.fn() } }));
vi.mock('@capacitor/preferences', () => ({ Preferences: { get: vi.fn(), set: vi.fn(), remove: vi.fn() } }));
vi.mock('../std.ts', () => ({ stdurl: (url: string) => new URL(url, 'https://tak.example.com') }));
vi.mock('./capacitor.ts', () => ({ isNativePlatform: () => true }));

const { APP_SCHEME, base64url, createChallenge, parseSSOCallback } = await import('./native-sso.ts');

describe('native SSO', () => {
    it('uses the app ID as its URL scheme', () => {
        expect(APP_SCHEME).toBe('nz.tak.app');
    });

    it('encodes base64url without padding', () => {
        expect(base64url(new Uint8Array([251, 255, 254]))).toBe('-__-');
        expect(base64url(new Uint8Array([1]))).toBe('AQ');
    });

    it('creates a challenge that is the SHA-256 of the verifier', async () => {
        const { verifier, challenge } = await createChallenge();
        expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(challenge).toBe(createHash('sha256').update(verifier).digest('base64url'));
        expect((await createChallenge()).verifier).not.toBe(verifier);
    });

    it('parses a code callback', () => {
        expect(parseSSOCallback('nz.tak.app://login?code=abc.def')).toEqual({ code: 'abc.def' });
    });

    it('parses an error callback, which wins over a code', () => {
        expect(parseSSOCallback('nz.tak.app://login?sso_error=Denied&code=x')).toEqual({ error: 'Denied' });
    });

    it('ignores other URLs', () => {
        expect(parseSSOCallback('nz.tak.app://other?code=abc')).toBeNull();
        expect(parseSSOCallback('https://login/?code=abc')).toBeNull();
        expect(parseSSOCallback('io.cloudtak.app://login?code=abc')).toBeNull();
        expect(parseSSOCallback('nz.tak.app://login')).toBeNull();
        expect(parseSSOCallback('not a url')).toBeNull();
    });
});
