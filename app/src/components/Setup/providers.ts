/**
 * TAK.NZ: the list of servers offered on the first-run Setup page.
 *
 * It comes from https://app.tak.nz/v1/servers.json (repository TAK-NZ/app.tak.nz),
 * which replaces upstream's registry. The page must never be left without
 * choices, so the list is resolved in this order:
 *
 *   1. the registry, if it answers with at least one valid server
 *   2. the last list that was downloaded, kept on the device
 *   3. the servers built into the app
 *
 * Entries are untrusted input: whoever can edit the registry decides where
 * users sign in, so anything that is not a plain https host is dropped.
 */
import { Preferences } from '@capacitor/preferences'
import { fetchWithTimeout } from './connect.ts'

export const PROVIDER_REGISTRY_URL = 'https://app.tak.nz/v1/servers.json'

const CACHE_KEY = 'providersCache'
const REGISTRY_TIMEOUT_MS = 8000
const MAX_LOGO_BASE64_LENGTH = 200_000
const LOGO_MEDIA_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
// A host name only (optionally with a port). No scheme, userinfo, path or query
const HOST_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:\d{1,5})?$/

export type ProviderLogo = {
    filename?: string
    mediaType?: string
    base64?: string
    // Only set for logos shipped inside the app
    url?: string
}

export type Provider = {
    name: string
    url: string
    logo?: ProviderLogo
}

/** Used when the registry cannot be reached and nothing is cached. Keep in step with servers.json in TAK-NZ/app.tak.nz */
export const BUNDLED_PROVIDERS: Provider[] = [
    { name: 'TAK.NZ Demo', url: 'map.demo.tak.nz', logo: { url: '/taknz-provider.png' } },
    { name: 'TAK.NZ Test', url: 'map.test.tak.nz', logo: { url: '/taknz-provider.png' } },
]

export type ProviderSource = 'network' | 'cache' | 'bundled'

/** Keep only well-formed https servers from an untrusted registry document */
export function sanitizeProviders(data: unknown): Provider[] {
    const servers = (data as { servers?: unknown } | null)?.servers
    if (!Array.isArray(servers)) return []

    const seen = new Set<string>()
    const providers: Provider[] = []

    for (const entry of servers) {
        if (!entry || typeof entry !== 'object') continue
        const { name, url, logo } = entry as { name?: unknown; url?: unknown; logo?: unknown }

        if (typeof name !== 'string' || !name.trim() || name.length > 100) continue
        if (typeof url !== 'string') continue

        // Registry hosts are bare names: the app adds https. Anything carrying
        // its own scheme (http:// in particular) is refused
        const host = url.trim().toLowerCase()
        if (!HOST_PATTERN.test(host) || seen.has(host)) continue
        seen.add(host)

        const provider: Provider = { name: name.trim(), url: host }

        if (logo && typeof logo === 'object') {
            const { filename, mediaType, base64 } = logo as ProviderLogo
            if (
                typeof base64 === 'string'
                && base64.length > 0
                && base64.length <= MAX_LOGO_BASE64_LENGTH
                && /^[A-Za-z0-9+/=]+$/.test(base64)
                && typeof mediaType === 'string'
                && LOGO_MEDIA_TYPES.has(mediaType)
            ) {
                provider.logo = { filename: typeof filename === 'string' ? filename : undefined, mediaType, base64 }
            }
        }

        providers.push(provider)
    }

    return providers
}

/** The image source for a provider's logo, or null when it has none */
export function providerLogoSrc(provider: Provider): string | null {
    if (provider.logo?.url) return provider.logo.url
    if (!provider.logo?.base64) return null
    return `data:${provider.logo.mediaType || 'image/png'};base64,${provider.logo.base64}`
}

async function readCache(): Promise<Provider[]> {
    try {
        const { value } = await Preferences.get({ key: CACHE_KEY })
        if (!value) return []
        // Re-checked on the way out, as the cache is only as trustworthy as the device storage
        return sanitizeProviders({ servers: JSON.parse(value) })
    } catch {
        return []
    }
}

async function writeCache(providers: Provider[]): Promise<void> {
    try {
        await Preferences.set({ key: CACHE_KEY, value: JSON.stringify(providers) })
    } catch (err) {
        console.warn('Failed to cache the provider list', err)
    }
}

/**
 * Resolve the list shown on the Setup page. Never throws and never returns an
 * empty list
 */
export async function loadProviders(): Promise<{ providers: Provider[]; source: ProviderSource }> {
    try {
        const response = await fetchWithTimeout(PROVIDER_REGISTRY_URL, REGISTRY_TIMEOUT_MS)
        if (!response.ok) throw new Error(`Provider list request failed with status ${response.status}`)
        const providers = sanitizeProviders(await response.json())
        if (providers.length) {
            await writeCache(providers)
            return { providers, source: 'network' }
        }
        console.warn('The provider list had no valid servers')
    } catch (err) {
        console.warn('Failed to load the provider list', err)
    }

    const cached = await readCache()
    if (cached.length) return { providers: cached, source: 'cache' }

    return { providers: BUNDLED_PROVIDERS, source: 'bundled' }
}
