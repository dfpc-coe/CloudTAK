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

export function isSafeUrl(href: string): { safe: boolean; url?: URL; reason?: string } {
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

    return { safe: true, url };
}
