import fs from 'node:fs/promises';
import type { Message, LocalMessage, Transform, ConvertResponse } from '../types.ts';
import path from 'node:path';
import Sharp from 'sharp';
import { glob } from 'glob';
import StreamZip from 'node-stream-zip';
import { kml } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';
import { isSafeUrl } from '../safeurl.ts';
import { fetch } from 'undici';

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

                    const buf = Buffer.from(await res.arrayBuffer());
                    // Detect KMZ by ZIP magic bytes (PK\x03\x04) since content-type is unreliable
                    const isKmz = buf.length >= 4
                        && buf[0] === 0x50 && buf[1] === 0x4B
                        && buf[2] === 0x03 && buf[3] === 0x04;

                    let linkedFeatures: ReturnType<typeof kml>['features'];

                    if (isKmz) {
                        const tmpKmzPath = path.join(this.local.tmpdir, `nl-${Date.now()}.kmz`);
                        const extractDir = tmpKmzPath.replace(/\.kmz$/, '');
                        await fs.writeFile(tmpKmzPath, buf);
                        await fs.mkdir(extractDir, { recursive: true });
                        const zip = new StreamZip.async({ file: tmpKmzPath });
                        try {
                            const entries = await zip.entries();

                            // Validate all ZIP entries before extraction to prevent path traversal
                            const extractDirResolved = path.resolve(extractDir);
                            let hasUnsafeEntry = false;
                            for (const entry of Object.values(entries)) {
                                const entryResolved = path.resolve(extractDir, entry.name);
                                if (!entryResolved.startsWith(extractDirResolved + path.sep) && entryResolved !== extractDirResolved) {
                                    console.warn(`NetworkLink ${normalized} KMZ path traversal attempt detected (${entry.name}), skipping`);
                                    hasUnsafeEntry = true;
                                }
                            }
                            if (hasUnsafeEntry) {
                                console.warn(`NetworkLink ${normalized} KMZ contains unsafe ZIP entries, skipping extraction`);
                                continue;
                            }

                            let kmlFileName = 'doc.kml';
                            
                            if (!entries['doc.kml']) {
                                // Look for alternative KML files if doc.kml doesn't exist
                                const kmlFiles = Object.keys(entries).filter(name => name.toLowerCase().endsWith('.kml'));
                                
                                if (kmlFiles.length === 0) {
                                    console.warn(`NetworkLink ${normalized} KMZ has no KML files, skipping`);
                                    continue;
                                } else if (kmlFiles.length > 1) {
                                    console.warn(`NetworkLink ${normalized} KMZ has multiple KML files but no doc.kml, skipping`);
                                    continue;
                                } else {
                                    kmlFileName = kmlFiles[0];
                                    console.log(`NetworkLink ${normalized} KMZ using ${kmlFileName} instead of doc.kml`);
                                }
                            }
                            
                            const kmlFileResolved = path.resolve(extractDir, kmlFileName);
                            if (kmlFileResolved !== extractDirResolved && !kmlFileResolved.startsWith(extractDirResolved + path.sep)) {
                                console.warn(`NetworkLink ${normalized} KMZ path traversal attempt detected (${kmlFileName}), skipping`);
                                continue;
                            }
                            
                            // Extract everything so icon assets bundled in the linked KMZ are
                            // available on disk for the glob-based icon resolver.
                            await zip.extract(null, extractDir);
                            const kmlContent = await fs.readFile(kmlFileResolved, 'utf8');
                            // Use the directory containing the extracted KML as localDir so
                            // relative paths (icon refs, nested NetworkLinks) resolve correctly.
                            const kmlDir = path.dirname(kmlFileResolved);
                            linkedFeatures = await this.fetchFeatures(kmlContent, icons, depth + 1, normalized, kmlDir, visited);
                        } finally {
                            await zip.close();
                            await fs.unlink(tmpKmzPath).catch(() => { /* ignore */ });
                        }
                    } else {
                        linkedFeatures = await this.fetchFeatures(buf.toString('utf8'), icons, depth + 1, normalized, null, visited);
                    }

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
                    const iconName = feat.properties.icon as string;
                    if (iconName.includes('..') || path.isAbsolute(iconName)) {
                        console.warn(`icon ${iconName} rejected — invalid path`);
                        continue;
                    }

                    const search = await glob(path.resolve(this.local.tmpdir, '**/' + iconName));
                    if (!search.length) {
                        console.warn(`icon ${iconName} not found`);
                        continue;
                    }

                    const resolvedIcon = path.resolve(search[0]);
                    const tmpdirSafe = path.resolve(this.local.tmpdir);
                    if (!resolvedIcon.startsWith(tmpdirSafe + path.sep)) {
                        console.warn(`icon ${iconName} resolved outside tmpdir, skipping`);
                        continue;
                    }

                    icons.set(iconName, await fs.readFile(resolvedIcon));
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
            });

            try {
                const preentries = await zip.entries();

                // Validate all ZIP entries before extraction to prevent path traversal
                const tmpdirResolved = path.resolve(this.local.tmpdir);
                for (const entry of Object.values(preentries)) {
                    const entryResolved = path.resolve(this.local.tmpdir, entry.name);
                    if (!entryResolved.startsWith(tmpdirResolved + path.sep) && entryResolved !== tmpdirResolved) {
                        throw new Error(`Path traversal attempt detected in KMZ: ${entry.name}`);
                    }
                }

                let kmlFileName = 'doc.kml';

                if (!preentries['doc.kml']) {
                    // Look for alternative KML files if doc.kml doesn't exist
                    const kmlFiles = Object.keys(preentries).filter(name => name.toLowerCase().endsWith('.kml'));
                    
                    if (kmlFiles.length === 0) {
                        throw new Error('No KML files found in KMZ');
                    } else if (kmlFiles.length > 1) {
                        throw new Error('Multiple KML files found in KMZ but no doc.kml - ambiguous which file to use');
                    } else {
                        kmlFileName = kmlFiles[0];
                        console.log(`Using ${kmlFileName} instead of doc.kml in KMZ`);
                    }
                }

                const kmlFileResolved = path.resolve(this.local.tmpdir, kmlFileName);
                if (kmlFileResolved !== tmpdirResolved && !kmlFileResolved.startsWith(tmpdirResolved + path.sep)) {
                    throw new Error(`Path traversal attempt detected in KMZ: ${kmlFileName}`);
                }

                await zip.extract(null, this.local.tmpdir);

                asset = kmlFileResolved;
            } finally {
                await zip.close();
            }
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
