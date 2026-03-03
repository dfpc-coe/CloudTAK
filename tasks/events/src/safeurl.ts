import { lookup } from 'node:dns/promises';

// Private / loopback CIDR ranges that must not be reachable via outbound fetches (SSRF protection).
const PRIVATE_RANGES: Array<{ prefix: number[]; bits: number }> = [
    { prefix: [127],              bits: 8  },  // loopback
    { prefix: [10],               bits: 8  },  // RFC 1918
    { prefix: [172, 16],          bits: 12 },  // RFC 1918
    { prefix: [192, 168],         bits: 16 },  // RFC 1918
    { prefix: [169, 254],         bits: 16 },  // link-local
    { prefix: [100, 64],          bits: 10 },  // CGNAT
];

export function isPrivateIPv4(hostname: string): boolean {
    const parts = hostname.split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return false;
    for (const range of PRIVATE_RANGES) {
        const bytesToCheck = Math.ceil(range.bits / 8);
        const match = range.prefix.every((b, i) => {
            if (i < bytesToCheck - 1) return parts[i] === b;
            // For the last byte, mask partial bits
            const mask = 0xff & (0xff << (8 - (range.bits % 8 || 8)));
            return (parts[i] & mask) === (b & mask);
        });
        if (match) return true;
    }
    return false;
}

/**
 * Expand a compressed IPv6 address into a 32-character hex string (no colons).
 * Returns null if the input is not a valid IPv6 address.
 */
function expandIPv6(addr: string): string | null {
    if (addr.includes('::')) {
        const halves = addr.split('::');
        if (halves.length !== 2) return null;
        const leftGroups  = halves[0] ? halves[0].split(':') : [];
        const rightGroups = halves[1] ? halves[1].split(':') : [];
        const missing = 8 - leftGroups.length - rightGroups.length;
        if (missing < 0) return null;
        const groups = [...leftGroups, ...Array(missing).fill('0'), ...rightGroups];
        if (groups.length !== 8) return null;
        return groups.map((g) => g.padStart(4, '0')).join('');
    }
    const groups = addr.split(':');
    if (groups.length !== 8) return null;
    return groups.map((g) => g.padStart(4, '0')).join('');
}

/**
 * Returns true for IPv6 addresses that fall in private/loopback/link-local ranges:
 *   ::1/128        loopback
 *   ::/128         unspecified
 *   fc00::/7       Unique Local Addresses (ULA)
 *   fe80::/10      link-local
 *   ::ffff:0:0/96  IPv4-mapped (checked via isPrivateIPv4 on the embedded address)
 */
export function isPrivateIPv6(address: string): boolean {
    // Remove zone ID (e.g. %eth0) and normalise to lowercase
    const addr = address.toLowerCase().split('%')[0];

    if (addr === '::1' || addr === '::') return true;

    const expanded = expandIPv6(addr);
    if (!expanded) return false;

    const byte0 = parseInt(expanded.slice(0, 2), 16);
    const byte1 = parseInt(expanded.slice(2, 4), 16);

    // fc00::/7 — ULA: high 7 bits of first byte are 0b1111110x (0xfc or 0xfd)
    if ((byte0 & 0xfe) === 0xfc) return true;

    // fe80::/10 — link-local: byte0 = 0xfe, high 2 bits of byte1 = 0b10xxxxxx
    if (byte0 === 0xfe && (byte1 & 0xc0) === 0x80) return true;

    // ::ffff:0:0/96 — IPv4-mapped: first 80 bits zero, next 16 bits 0xffff
    if (expanded.startsWith('00000000000000000000ffff')) {
        const v4Hex = expanded.slice(24);
        const parts = [
            parseInt(v4Hex.slice(0, 2), 16),
            parseInt(v4Hex.slice(2, 4), 16),
            parseInt(v4Hex.slice(4, 6), 16),
            parseInt(v4Hex.slice(6, 8), 16),
        ];
        return isPrivateIPv4(parts.join('.'));
    }

    return false;
}

export async function isSafeUrl(href: string): Promise<{ safe: boolean; url?: URL; reason?: string }> {
    let url: URL;
    try {
        url = new URL(href);
    } catch {
        return { safe: false, reason: `invalid URL: ${href}` };
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return { safe: false, url, reason: `unsupported protocol: ${url.protocol}` };
    }

    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, ''); // strip IPv6 brackets

    if (hostname === 'localhost' || hostname === '::1' || hostname === '0.0.0.0') {
        return { safe: false, url, reason: `blocked hostname: ${hostname}` };
    }

    if (isPrivateIPv4(hostname)) {
        return { safe: false, url, reason: `blocked private IP: ${hostname}` };
    }

    if (isPrivateIPv6(hostname)) {
        return { safe: false, url, reason: `blocked private IPv6: ${hostname}` };
    }

    // Resolve the hostname via DNS and reject any result that maps to a private address.
    // This guards against SSRF via public-looking hostnames that resolve to internal IPs.
    // Fail open on DNS errors so that unreachable-but-legitimate hosts are not silently
    // blocked; the subsequent fetch will surface any connectivity issues on its own.
    try {
        const records = await lookup(hostname, { all: true });
        for (const { address, family } of records) {
            if (family === 4 && isPrivateIPv4(address)) {
                return { safe: false, url, reason: `hostname resolves to blocked private IP: ${address}` };
            }
            if (family === 6 && isPrivateIPv6(address)) {
                return { safe: false, url, reason: `hostname resolves to blocked private IPv6: ${address}` };
            }
        }
    } catch {
        // DNS lookup failed (e.g. NXDOMAIN, no network) — allow and let the fetch fail
    }

    return { safe: true, url };
}
