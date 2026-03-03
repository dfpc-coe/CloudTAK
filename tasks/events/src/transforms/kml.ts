import fs from 'node:fs/promises';
import type { Message, LocalMessage, Transform, ConvertResponse } from '../types.ts';
import path from 'node:path';
import Sharp from 'sharp';
import { glob } from 'glob';
import StreamZip from 'node-stream-zip';
import { kml } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';
import { isSafeUrl } from '../safeurl.ts';

const MAX_NETWORK_LINK_DEPTH = 3;
const NETWORK_LINK_FETCH_TIMEOUT_MS = 10_000;

export default class KML implements Transform {
    static register() {
        return {
            inputs: ['.kml', '.kmz']
        };
    }

    msg: Message;
    local: LocalMessage;

    constructor(
        msg: Message,
        local: LocalMessage
    ) {
        this.msg = msg;
        this.local = local;
    }

    async fetchFeatures(
        kmlContent: string,
        icons: Map<string, Buffer>,
        depth: number,
        baseUrl: string | null = null,
        localDir: string | null = null,
        visited: Set<string> = new Set()
    ): Promise<ReturnType<typeof kml>['features']> {
        const dom = new DOMParser().parseFromString(kmlContent, 'text/xml');
        const allFeatures = kml(dom).features;

        const features: ReturnType<typeof kml>['features'] = [];

        for (const feat of allFeatures) {
            if (!feat.properties) feat.properties = {};

            if (feat.properties['@geometry-type'] === 'networklink') {
                if (depth >= MAX_NETWORK_LINK_DEPTH) {
                    console.warn(`NetworkLink skipped — max depth of ${MAX_NETWORK_LINK_DEPTH} reached`);
                    continue;
                }

                let href = feat.properties.href as string | undefined;

                if (!href) {
                    console.warn('NetworkLink has no href, skipping');
                    continue;
                }

                // Reject any explicit URI scheme other than http / https before local-path handling
                if (href.includes('://') && !href.startsWith('http://') && !href.startsWith('https://')) {
                    console.warn(`NetworkLink ${href} skipped — unsupported protocol`);
                    continue;
                }

                if (!href.startsWith('http://') && !href.startsWith('https://')) {
                    if (localDir) {
                        // Local relative resolution — path must stay within tmpdir
                        const resolved = path.resolve(localDir, href);
                        const tmpdirSafe = path.resolve(this.local.tmpdir);

                        if (resolved !== tmpdirSafe && !resolved.startsWith(tmpdirSafe + path.sep)) {
                            console.warn(`NetworkLink ${href} would escape data directory, skipping`);
                            continue;
                        }

                        if (visited.has(resolved)) {
                            console.warn(`NetworkLink ${resolved} already visited, skipping`);
                            continue;
                        }
                        visited.add(resolved);

                        try {
                            const localContent = await fs.readFile(resolved, 'utf8');
                            const linkedFeatures = await this.fetchFeatures(
                                localContent, icons, depth + 1, null, path.dirname(resolved), visited
                            );
                            features.push(...linkedFeatures);
                        } catch (err) {
                            console.warn(`NetworkLink local file ${href} not readable (${err})`);
                        }

                        continue;
                    } else if (baseUrl) {
                        // HTTP relative resolution — resolved URL must stay on the same origin
                        let resolved: URL;
                        try {
                            resolved = new URL(href, baseUrl);
                        } catch {
                            console.warn(`NetworkLink href ${href} could not be resolved relative to ${baseUrl}, skipping`);
                            continue;
                        }

                        const base = new URL(baseUrl);
                        if (resolved.origin !== base.origin) {
                            console.warn(`NetworkLink ${href} resolved to a different origin (${resolved.origin}), skipping`);
                            continue;
                        }

                        href = resolved.toString();
                        // fall through to SSRF check and fetch below
                    } else {
                        console.warn(`NetworkLink ${href} is relative but no base URL or local directory is available, skipping`);
                        continue;
                    }
                }

                const { safe, url, reason } = await isSafeUrl(href);
                if (!safe || !url) {
                    console.warn(`NetworkLink ${href} skipped — ${reason}`);
                    continue;
                }

                // Normalise the URL for deduplication (strip trailing slash, lowercase host)
                url.hostname = url.hostname.toLowerCase();
                if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
                    url.pathname = url.pathname.replace(/\/+$/, '');
                }
                const normalized = url.toString();
                if (visited.has(normalized)) {
                    console.warn(`NetworkLink ${normalized} already visited, skipping`);
                    continue;
                }
                visited.add(normalized);

                try {
                    const res = await fetch(normalized, {
                        signal: AbortSignal.timeout(NETWORK_LINK_FETCH_TIMEOUT_MS)
                    });

                    if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`);

                    const linked = await res.text();
                    const linkedFeatures = await this.fetchFeatures(linked, icons, depth + 1, normalized, null, visited);
                    features.push(...linkedFeatures);
                } catch (err) {
                    console.warn(`NetworkLink ${normalized} not retrievable (${err})`);
                }

                continue;
            }

            if (feat.properties.icon && !icons.has(feat.properties.icon as string)) {
                if ((feat.properties.icon as string).startsWith('http')) {
                    try {
                        const res = await fetch(feat.properties.icon as string);

                        if (!res.ok) {
                            throw new Error(`HTTP ${res.status} ${await res.text()}`);
                        }

                        const iconbuffer = Buffer.from(await res.arrayBuffer());

                        icons.set(feat.properties.icon as string, iconbuffer);
                    } catch (err) {
                        console.warn(`icon ${feat.properties.icon} not retrievable (${err})`);
                    }
                } else {
                    const search = await glob(path.resolve(this.local.tmpdir, '**/' + feat.properties.icon));
                    if (!search.length) {
                        console.warn(`icon ${feat.properties.icon} not found`);
                        continue;
                    }

                    icons.set(feat.properties.icon as string, await fs.readFile(search[0]));
                }
            }

            features.push(feat);
        }

        return features;
    }

    async convert(): Promise<ConvertResponse> {
        const icons = new Map<string, Buffer>();

        let asset;

        if (this.local.ext === '.kmz') {
            const zip = new StreamZip.async({
                file: this.local.raw,
                skipEntryNameValidation: true
            });

            const preentries = await zip.entries();

            if (!preentries['doc.kml']) throw new Error('No doc.kml found in KMZ');

            await zip.extract(null, this.local.tmpdir);

            asset = path.resolve(this.local.tmpdir, 'doc.kml');
        } else {
            asset = path.resolve(this.local.raw);
        }

        const features = await this.fetchFeatures(String(await fs.readFile(asset)), icons, 0, null, path.dirname(asset));

        console.error('ok - converted to GeoJSON');

        const output = path.resolve(this.local.tmpdir, this.local.id + '.geojsonld');

        await fs.writeFile(output, features.map((feat) => {
            return JSON.stringify(feat);
        }).join('\n'));

        const iconMap = new Set<{
            name: string;
            data: string;
        }>();

        for (const [name, icon] of icons.entries()) {
            try {
                const contents = await (Sharp(icon)
                    .png()
                    .toBuffer());

                iconMap.add({
                    name: name.replace(/.[a-z]+$/, '.png'),
                    data: `data:image/png;base64,${contents.toString('base64')}`
                });
            } catch (err) {
                console.error(`failing to process ${name}`, err);
            }
        }

        if (iconMap.size) {
            return {
                asset: output,
                icons: iconMap
            }
        } else {
            return {
                asset: output
            }
        }
    }
}
