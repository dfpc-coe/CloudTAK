import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchWithTimeout, normalizeServerUrl, validateServer } from '../components/Setup/connect.ts'

describe('normalizeServerUrl', () => {
    it('returns null for empty or whitespace input', () => {
        expect(normalizeServerUrl('')).toBeNull()
        expect(normalizeServerUrl('   ')).toBeNull()
    })

    it('returns null for unparseable input', () => {
        expect(normalizeServerUrl('https://')).toBeNull()
        expect(normalizeServerUrl('not a url')).toBeNull()
    })

    it('defaults to https when no scheme is given', () => {
        expect(normalizeServerUrl('cloudtak.example.com')).toBe('https://cloudtak.example.com')
    })

    it('preserves an explicit http scheme', () => {
        expect(normalizeServerUrl('http://cloudtak.example.com')).toBe('http://cloudtak.example.com')
    })

    it('trims whitespace and trailing slashes', () => {
        expect(normalizeServerUrl('  https://cloudtak.example.com///  ')).toBe('https://cloudtak.example.com')
    })

    it('keeps a path prefix but drops query and hash', () => {
        expect(normalizeServerUrl('https://example.com/tak/?foo=1#bar')).toBe('https://example.com/tak')
    })

    it('keeps an explicit port', () => {
        expect(normalizeServerUrl('cloudtak.example.com:8443')).toBe('https://cloudtak.example.com:8443')
    })
})

describe('validateServer', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn())
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.useRealTimers()
    })

    function mockResponse(body: unknown, ok = true, status = 200): void {
        vi.mocked(fetch).mockResolvedValue({
            ok,
            status,
            json: async () => body
        } as Response)
    }

    it('accepts a supported server version', async () => {
        mockResponse({ version: '13.31.0' })
        await expect(validateServer('https://example.com')).resolves.toBeUndefined()
        expect(fetch).toHaveBeenCalledWith('https://example.com/api', expect.objectContaining({ cache: 'no-store' }))
    })

    it('accepts a v-prefixed version', async () => {
        mockResponse({ version: 'v12.0.0' })
        await expect(validateServer('https://example.com')).resolves.toBeUndefined()
    })

    it('rejects an unsupported major version', async () => {
        mockResponse({ version: '11.5.0' })
        await expect(validateServer('https://example.com')).rejects.toThrow(/not supported/)
    })

    it('rejects a non-2xx response', async () => {
        mockResponse({}, false, 502)
        await expect(validateServer('https://example.com')).rejects.toThrow(/status 502/)
    })

    it('rejects a missing version', async () => {
        mockResponse({})
        await expect(validateServer('https://example.com')).rejects.toThrow(/did not return a version/)
    })

    it('rejects an unparseable version', async () => {
        mockResponse({ version: 'beta' })
        await expect(validateServer('https://example.com')).rejects.toThrow(/Unable to parse version/)
    })

    it('rejects a non-JSON body with a friendly message', async () => {
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => { throw new SyntaxError('Unexpected token <') }
        } as unknown as Response)

        await expect(validateServer('https://example.com')).rejects.toThrow(/Is this a CloudTAK server/)
    })

    it('maps network failures to a friendly message', async () => {
        vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))
        await expect(validateServer('https://example.com')).rejects.toThrow(/Unable to reach the server/)
    })
})

describe('fetchWithTimeout', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
        vi.useRealTimers()
    })

    it('aborts a hung request and reports a timeout', async () => {
        vi.useFakeTimers()
        vi.stubGlobal('fetch', vi.fn((_url: string, opts: RequestInit) => {
            return new Promise((resolve, reject) => {
                opts.signal?.addEventListener('abort', () => {
                    reject(new DOMException('Aborted', 'AbortError'))
                })
            })
        }))

        const pending = fetchWithTimeout('https://example.com/api', 5000)
        const assertion = expect(pending).rejects.toThrow(/took too long/)
        await vi.advanceTimersByTimeAsync(5000)
        await assertion
    })

    it('clears the timeout and returns the response on success', async () => {
        const response = { ok: true } as Response
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

        await expect(fetchWithTimeout('https://example.com/api')).resolves.toBe(response)
    })
})
