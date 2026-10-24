/**
 * Glyph Manager - serves MapLibre font glyph ranges through the
 * `cloudtak-glyphs://` protocol.
 *
 * A tile cannot render any of its layers until every glyph range its labels
 * need has loaded, and MapLibre's own glyph requests never time out. Ranges
 * are therefore served from a bundled copy or the Dexie cache first, and a
 * network fetch is bounded so a stalled connection fails over to MapLibre's
 * locally drawn glyphs instead of holding the tile.
 */
import * as mapgl from 'maplibre-gl';
import { db, withDbRetry } from '../../database.ts';
import { stdurl, getRuntimeToken, fetchWithTimeout } from '../../std.ts';
import openSansBold0 from '../../assets/glyphs/open-sans-bold-0-255.pbf?url';

const GLYPH_PROTOCOL = 'cloudtak-glyphs';

export const GLYPH_REQUEST_TIMEOUT_MS = 10000;

/** Ranges shipped with the app so the default label font never waits on the network */
const BUNDLED: Record<string, string> = {
    'Open Sans Bold/0-255': openSansBold0
};

let registered = false;
const bundled = new Map<string, Promise<ArrayBuffer>>();

export default class GlyphManager {
    /** MapLibre style `glyphs` template routed through the protocol */
    static glyphsUrl(): string {
        GlyphManager.registerProtocol();

        return `${GLYPH_PROTOCOL}://{fontstack}/{range}.pbf`;
    }

    static registerProtocol(): void {
        if (registered) return;
        registered = true;

        mapgl.addProtocol(GLYPH_PROTOCOL, async (params) => {
            const match = /^cloudtak-glyphs:\/\/(.+)\/(\d+-\d+)\.pbf$/.exec(params.url);
            if (!match) throw new Error(`Unsupported glyph URL: ${params.url}`);

            return {
                data: await GlyphManager.load(decodeURIComponent(match[1]), match[2])
            };
        });
    }

    static async load(fontstack: string, range: string): Promise<ArrayBuffer> {
        const key = `${fontstack}/${range}`;

        if (BUNDLED[key]) return await GlyphManager.loadBundled(key);

        try {
            const row = await db.glyph.get(key);
            if (row) return row.data;
        } catch (err) {
            console.warn(`Glyph cache read failed for ${key}`, err);
        }

        const data = await GlyphManager.fetch(fontstack, range);

        try {
            await withDbRetry(() => db.glyph.put({ id: key, data, updated: Date.now() }));
        } catch (err) {
            console.warn(`Glyph cache write failed for ${key}`, err);
        }

        return data;
    }

    private static async loadBundled(key: string): Promise<ArrayBuffer> {
        let pending = bundled.get(key);

        if (!pending) {
            pending = (async () => {
                const res = await fetch(BUNDLED[key]);
                if (!res.ok) throw new Error(`Bundled glyph range ${key} unavailable (${res.status})`);
                return await res.arrayBuffer();
            })().catch((err: unknown) => {
                bundled.delete(key);
                throw err;
            });

            bundled.set(key, pending);
        }

        return (await pending).slice(0);
    }

    private static async fetch(fontstack: string, range: string): Promise<ArrayBuffer> {
        const url = stdurl(`/api/fonts/${encodeURIComponent(fontstack)}/${range}.pbf`);
        const token = await getRuntimeToken();

        const res = await fetchWithTimeout(GLYPH_REQUEST_TIMEOUT_MS)(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });

        if (!res.ok) throw new Error(`Failed to load glyph range ${fontstack}/${range} (${res.status})`);

        return await res.arrayBuffer();
    }
}
