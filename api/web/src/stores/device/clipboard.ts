import type { Feature } from '../../types.ts';

const JSON_MIME = 'application/json';

// Chromium restricts ClipboardItem to a small set of well-known MIME types;
// arbitrary types are only writable as "web "-prefixed Web Custom Formats
const WEB_JSON_MIME = `web ${JSON_MIME}`;

export async function copyFeatureToClipboard(feat: Feature): Promise<void> {
    const json = JSON.stringify(feat);

    for (const mime of [JSON_MIME, WEB_JSON_MIME]) {
        try {
            await navigator.clipboard.write([
                new ClipboardItem({
                    [mime]: new Blob([json], { type: JSON_MIME }),
                    'text/plain': new Blob([json], { type: 'text/plain' })
                })
            ]);
            return;
        } catch {
            // Browser rejected the MIME type - try the next representation
        }
    }

    await navigator.clipboard.writeText(json);
}

export type ClipboardReadAccess = 'granted' | 'prompt' | 'denied';

/**
 * Whether the clipboard can be read, and if so whether reading it will first
 * surface browser UI (a permission dialog in Chromium, a "Paste" confirmation
 * popup in Firefox). Callers should only read speculatively - eg. to decide
 * whether to offer a paste action - when access is 'granted'.
 */
export async function clipboardReadAccess(): Promise<ClipboardReadAccess> {
    if (!navigator.clipboard) return 'denied';

    try {
        const status = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName });
        return status.state;
    } catch {
        // Firefox does not expose clipboard-read to the Permissions API - reads
        // are always mediated by its paste confirmation popup
        return 'prompt';
    }
}

export async function readFeatureFromClipboard(): Promise<Feature | null> {
    try {
        const items = await navigator.clipboard.read();

        for (const item of items) {
            const mime = [JSON_MIME, WEB_JSON_MIME, 'text/plain'].find((m) => item.types.includes(m));
            if (!mime) continue;

            const feat = parseFeature(await (await item.getType(mime)).text());
            if (feat) return feat;
        }

        return null;
    } catch {
        // clipboard.read() is unsupported (Firefox) or was denied
        try {
            return parseFeature(await navigator.clipboard.readText());
        } catch {
            return null;
        }
    }
}

function parseFeature(text: string): Feature | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return null;
    }

    if (!parsed || typeof parsed !== 'object') return null;

    const feat = parsed as Feature;

    // Only Point features can be pasted for now - the pasted feature inherits
    // the paste location, which has no meaningful mapping for Line/Polygon geometries
    if (
        feat.type !== 'Feature'
        || !feat.geometry
        || feat.geometry.type !== 'Point'
        || !('coordinates' in feat.geometry)
        || !feat.properties
        || typeof feat.properties !== 'object'
    ) return null;

    // COT.styleProperties fills in the remaining defaults (time/start/stale/how/remarks)
    if (typeof feat.path !== 'string') feat.path = '/';
    if (typeof feat.properties.type !== 'string') feat.properties.type = 'u-d-p';
    if (typeof feat.properties.callsign !== 'string') feat.properties.callsign = 'Pasted Feature';

    return feat;
}
