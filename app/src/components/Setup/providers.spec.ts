import { beforeEach, describe, expect, it, vi } from 'vitest'

const prefs = new Map<string, string>()
const fetchMock = vi.fn()

vi.mock('@capacitor/preferences', () => ({
    Preferences: {
        get: vi.fn(async ({ key }: { key: string }) => ({ value: prefs.get(key) ?? null })),
        set: vi.fn(async ({ key, value }: { key: string; value: string }) => { prefs.set(key, value) }),
    },
}))
vi.mock('./connect.ts', () => ({ fetchWithTimeout: (...args: unknown[]) => fetchMock(...args) }))

const { BUNDLED_PROVIDERS, PROVIDER_REGISTRY_URL, loadProviders, providerLogoSrc, sanitizeProviders } = await import('./providers.ts')

const png = 'iVBORw0KGgo='
const good = { name: 'TAK.NZ Demo', url: 'map.demo.tak.nz', logo: { filename: 'a.png', mediaType: 'image/png', base64: png } }

function respond(body: unknown, ok = true) {
    fetchMock.mockResolvedValueOnce({ ok, status: ok ? 200 : 500, json: async () => body })
}

describe('provider list', () => {
    beforeEach(() => {
        prefs.clear()
        fetchMock.mockReset()
        vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    })

    it('reads the TAK.NZ registry, not upstream', () => {
        expect(PROVIDER_REGISTRY_URL).toBe('https://app.tak.nz/v1/servers.json')
    })

    describe('sanitizeProviders', () => {
        it('keeps well-formed servers', () => {
            expect(sanitizeProviders({ servers: [good] })).toEqual([{ name: 'TAK.NZ Demo', url: 'map.demo.tak.nz', logo: good.logo }])
        })

        it('drops anything that is not a plain https host', () => {
            const urls = ['http://map.example.nz', 'https://map.example.nz', 'map.example.nz/api', 'user@map.example.nz', 'localhost', 'javascript:alert(1)', '']
            for (const url of urls) {
                expect(sanitizeProviders({ servers: [{ name: 'X', url }] }), url).toEqual([])
            }
        })

        it('drops duplicates and entries without a name', () => {
            const result = sanitizeProviders({ servers: [good, { ...good, name: 'Again' }, { url: 'map.b.example.nz' }, null, 'x'] })
            expect(result.map((p) => p.url)).toEqual(['map.demo.tak.nz'])
        })

        it('keeps the server but drops a logo that is not a small png/jpeg/webp', () => {
            for (const logo of [
                { mediaType: 'image/svg+xml', base64: png },
                { mediaType: 'image/png', base64: '<script>' },
                { mediaType: 'image/png', base64: 'A'.repeat(200_001) },
                { mediaType: 'text/html', base64: png },
            ]) {
                const [provider] = sanitizeProviders({ servers: [{ ...good, logo }] })
                expect(provider.url).toBe('map.demo.tak.nz')
                expect(provider.logo).toBeUndefined()
            }
        })

        it('returns nothing for a malformed document', () => {
            for (const doc of [null, undefined, {}, { servers: 'x' }, []]) expect(sanitizeProviders(doc)).toEqual([])
        })
    })

    describe('providerLogoSrc', () => {
        it('builds a data URL, or uses a bundled path', () => {
            expect(providerLogoSrc(good)).toBe(`data:image/png;base64,${png}`)
            expect(providerLogoSrc({ name: 'x', url: 'a.b', logo: { url: '/taknz-provider.png' } })).toBe('/taknz-provider.png')
            expect(providerLogoSrc({ name: 'x', url: 'a.b' })).toBeNull()
        })
    })

    describe('loadProviders', () => {
        it('uses the registry and saves it for next time', async () => {
            respond({ servers: [good] })
            const result = await loadProviders()
            expect(result.source).toBe('network')
            expect(result.providers.map((p) => p.url)).toEqual(['map.demo.tak.nz'])
            expect(JSON.parse(prefs.get('providersCache') as string)).toHaveLength(1)
        })

        it('falls back to the saved list when the registry is down', async () => {
            respond({ servers: [good] })
            await loadProviders()
            fetchMock.mockRejectedValueOnce(new Error('offline'))
            const result = await loadProviders()
            expect(result.source).toBe('cache')
            expect(result.providers.map((p) => p.url)).toEqual(['map.demo.tak.nz'])
        })

        it('falls back to the built-in list when there is no registry and nothing saved', async () => {
            fetchMock.mockRejectedValueOnce(new Error('offline'))
            const result = await loadProviders()
            expect(result.source).toBe('bundled')
            expect(result.providers).toEqual(BUNDLED_PROVIDERS)
            expect(result.providers.map((p) => p.url)).toEqual(['map.demo.tak.nz', 'map.test.tak.nz'])
        })

        it('does not trade a good saved list for an empty or invalid registry answer', async () => {
            respond({ servers: [good] })
            await loadProviders()
            respond({ servers: [{ name: 'Evil', url: 'http://evil.example' }] })
            const result = await loadProviders()
            expect(result.source).toBe('cache')
            expect(result.providers.map((p) => p.url)).toEqual(['map.demo.tak.nz'])
        })

        it('treats an error status as a failure', async () => {
            respond({ servers: [good] }, false)
            expect((await loadProviders()).source).toBe('bundled')
        })

        it('ignores a corrupt or tampered saved list', async () => {
            prefs.set('providersCache', '{not json')
            fetchMock.mockRejectedValueOnce(new Error('offline'))
            expect((await loadProviders()).source).toBe('bundled')
            prefs.set('providersCache', JSON.stringify([{ name: 'Evil', url: 'http://evil.example' }]))
            fetchMock.mockRejectedValueOnce(new Error('offline'))
            expect((await loadProviders()).source).toBe('bundled')
        })
    })
})
