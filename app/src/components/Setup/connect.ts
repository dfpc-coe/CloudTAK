/**
 * Server-connection helpers for the first-run Setup page. Every network call
 * is bounded by a timeout and every failure maps to a user-actionable message.
 */

const REQUEST_TIMEOUT_MS = 10000
const MIN_SUPPORTED_MAJOR = 12

/**
 * Normalize user/provider input into a server base URL, or return null if it
 * cannot be parsed. Scheme defaults to https, trailing slashes are dropped,
 * and query/hash are discarded.
 */
export function normalizeServerUrl(raw: string): string | null {
    const trimmed = raw.trim()
    if (!trimmed) return null

    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

    try {
        const url = new URL(withScheme)
        return `${url.origin}${url.pathname}`.replace(/\/+$/, '')
    } catch {
        return null
    }
}

export async function fetchWithTimeout(url: string, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<Response> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
        return await fetch(url, { signal: controller.signal, cache: 'no-store' })
    } catch (err) {
        // Webviews are inconsistent about what an aborted fetch rejects with,
        // so the abort flag identifies our own timeout.
        if (controller.signal.aborted) {
            throw new Error('The server took too long to respond. Check your connection and try again.', { cause: err })
        }

        throw new Error('Unable to reach the server. Check your connection and try again.', { cause: err })
    } finally {
        clearTimeout(timeout)
    }
}

/**
 * Confirm the URL points at a CloudTAK server of a supported version before
 * it is persisted as the app's backend.
 */
export async function validateServer(url: string, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<void> {
    const response = await fetchWithTimeout(`${url}/api`, timeoutMs)
    if (!response.ok) throw new Error(`Server responded with status ${response.status}`)

    let version: unknown
    try {
        version = (await response.json())?.version
    } catch (err) {
        throw new Error('Server did not return a valid response. Is this a CloudTAK server?', { cause: err })
    }

    if (!version) throw new Error('Server did not return a version')

    const match = String(version).match(/^v?(\d+)/)
    if (!match) throw new Error(`Unable to parse version: ${version}`)

    const major = parseInt(match[1], 10)
    if (major < MIN_SUPPORTED_MAJOR) {
        throw new Error(`Server version ${version} is not supported. Version v${MIN_SUPPORTED_MAJOR} or higher is required.`)
    }
}
