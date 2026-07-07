import DataTransform from './transform.ts';
import { isZipFile } from './sniff.ts';
import { rimraf } from 'rimraf';
import { randomUUID } from 'node:crypto';
import { Upload } from '@aws-sdk/lib-storage';
import { EventEmitter } from 'node:events';
import type { Message, LocalMessage, Asset, ProfileFeature, Basemap as BasemapResponse, TransformResult, GroundOverlaySource } from './types.ts';
import jwt from 'jsonwebtoken';
import os from 'node:os';
import fs from 'node:fs';
import cp from 'node:child_process';
import path from 'node:path';
import Sharp from 'sharp';
import s3client from './s3.ts';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { pipeline } from 'node:stream/promises';
import { CoTParser, DataPackage, Iconset, Basemap } from '@tak-ps/node-cot';
import { createImportResult } from './api.ts';
import { fetch } from '@tak-ps/node-safeurl';

export default class Worker extends EventEmitter {
    msg: Message;

    constructor(msg: Message) {
        super();

        this.msg = msg;
    }

    normalizeBasemapFormat(tileType?: string): string | undefined {
        if (!tileType) return undefined;

        return tileType.replace(/^image\//, '').toLowerCase();
    }

    async process() {
        let local: LocalMessage | undefined = undefined;

        try {
            console.error(`Import: ${this.msg.job.id}`, JSON.stringify(this.msg.job));

            const s3 = s3client();

            const tmpdir = fs.mkdtempSync(path.resolve(os.tmpdir(), 'cloudtak-'));
            let { ext } = path.parse(this.msg.job.name);
            const originalExt = ext;
            ext = ext.toLowerCase();
            const name = `${this.msg.job.id}${ext}`;

            local = {
                id: this.msg.job.id,
                ext,
                name: this.msg.job.name,
                tmpdir,
                raw: path.resolve(tmpdir, name),
            };

            await pipeline(
                // @ts-expect-error 'StreamingBlobPayloadOutputTypes | undefined' is not assignable to parameter of type 'ReadableStream'
                (await s3.send(new GetObjectCommand({
                    Bucket: this.msg.bucket,
                    Key: `import/${local.id}${originalExt}`,
                }))).Body,
                fs.createWriteStream(local.raw),
            );

            if (await isZipFile(local.raw)) {
                await this.processArchive(local);
            } else {
                await this.processFile(local);
            }

            if (local) await rimraf(local.tmpdir);

            this.emit('success');
        } catch (err) {
            console.error(`import: ${this.msg.job.id} Error: `, err);

            if (local) await rimraf(local.tmpdir);

            this.emit('error', err);
        }
    }

    /**
     * Processes a zip file that may or may not be a DataPackage.
     * Zip Files that are not valid datapackages will be standardize to the same interface
     *
     * @param local - Local File Information Object
     */
    async processArchive(local: LocalMessage): Promise<void> {
        const pkg = await DataPackage.parse(local.raw, {
            cleanup: false,
            strict: false,
        });

        // If a .kml is present at the root level, assume an actual KMZ and process as a single file upload
        if (local.ext.toLowerCase() === '.kmz' && pkg.contents.some((content) => {
            const p = path.parse(content._attributes.zipEntry);
            return !p.dir && p.ext.toLowerCase() === '.kml';
        })) {
            await this.processFile(local);
            return;
        }

        // We disable cleanup in the parser just in case we choose to
        // treat it as a single file upload above
        fs.unlinkSync(local.raw);

        const s3 = s3client();

        const cots = await pkg.cots();
        for (const cot of cots) {
            const feat = await CoTParser.to_geojson(cot);

            if (feat.properties.attachments) {
                const attachments = await pkg.attachments();
                for (const uid of attachments.keys()) {
                    const contents = attachments.get(uid);
                    if (!contents || !contents.length) continue;

                    for (const content of contents) {
                        const hash = await pkg.hash(content._attributes.zipEntry);
                        const name = path.parse(content._attributes.zipEntry).base;

                        console.log(`ok - uploading: s3://${this.msg.bucket}/attachment/${hash}/${name}`);
                        await s3.send(new PutObjectCommand({
                            Bucket: this.msg.bucket,
                            Key: `attachment/${hash}/${name}`,
                            Body: await pkg.getFile(content._attributes.zipEntry),
                        }));
                    }
                }
            }

            const url = new URL(`/api/profile/feature`, this.msg.api);
            url.searchParams.append('broadcast', String(true));
            const res = await fetch(url, {
                safeUrlAllow: [this.msg.api],
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${jwt.sign({ access: 'user', email: this.msg.job.username }, this.msg.secret)}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...feat,
                    path: `/${pkg.settings.name.replace(/\//g, '')}/`,
                }),
            });

            if (!res.ok) {
                const json = (await res.json()) as { message: string };
                console.error(json.message);
            } else {
                const feature = await res.json() as ProfileFeature;
                await createImportResult(this.msg, {
                    name: feat.id as string,
                    type: 'Feature',
                    type_id: String(feature.id),
                });
            }
        }

        const files = await pkg.files();
        const indexes = [];

        for (const file of files) {
            const { ext, base } = path.parse(file);
            const extLower = ext.toLowerCase();

            if (base !== 'MANIFEST.xml' && extLower === '.xml') {
                indexes.push(file);
            } else {
                if (base === 'MANIFEST.xml') continue;
                if (['.png', '.xml'].includes(extLower)) continue;

                await this.processFile({
                    id: randomUUID(),
                    tmpdir: pkg.path,
                    ext: extLower,
                    name: base,
                    raw: path.resolve(pkg.path, './raw/', file),
                });
            }
        }

        if (indexes.length) {
            for (const index of indexes) {
                await this.processIndex(pkg, index);
            }
        }

        await pkg.destroy();
    }

    /**
     * Processes a file upload for a user profile asset.
     *
     * @param local - Local File Information Object
     */
    async processFile(
        local: LocalMessage,
    ): Promise<Asset | undefined> {
        if (local.ext.toLowerCase() === '.xml') {
            try {
                const xml = fs.readFileSync(local.raw, 'utf-8');
                await Basemap.parse(xml);

                await this.processBasemap(xml);
                return;
            } catch (err) {
                console.error('Basemap Error: ' + err);
            }
        }

        console.log(`Import: ${this.msg.job.id} - uploading profile asset`);

        const s3 = s3client();

        const id = randomUUID();

        const geouploader = new Upload({
            client: s3,
            params: {
                Bucket: this.msg.bucket,
                Key: `profile/${this.msg.job.username}/${id}${local.ext}`,
                Body: fs.createReadStream(local.raw),
            },
        });

        await geouploader.done();

        const res = await fetch(new URL(`/api/profile/asset`, this.msg.api), {
            safeUrlAllow: [this.msg.api],
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt.sign({ access: 'user', email: this.msg.job.username }, this.msg.secret)}`,
            },
            body: JSON.stringify({
                id,
                // It is important that the ext of the name is the same as the uploaded file
                // local.ext is always lowercase - normalize the name ext to match the S3 key
                name: path.parse(local.name).name + local.ext,
                // TODO Use Data Package Prefix
                path: '/',
            }),
        });

        if (!res.ok) throw new Error(await res.text());

        const asset = await res.json() as Asset;

        await createImportResult(this.msg, {
            name: asset.name,
            type: 'Asset',
            type_id: asset.id,
        });

        const transformer = new DataTransform(
            this.msg,
            local,
            asset,
        );

        const result = await transformer.run();

        if (result.groundOverlays.length) {
            await this.processGroundOverlays(local, asset, result);
        }

        return asset;
    }

    /**
     * Returns a file-scoped PMTiles access token that is embedded in the
     * tile URL of Basemap records created from uploaded files. The token only
     * grants access to the single PMTiles archive it was created for.
     */
    tileToken(file: string): string {
        return jwt.sign({
            access: 'profile',
            email: '',
            file: `${this.msg.job.username}/${file}`,
        }, this.msg.secret);
    }

    /**
     * Creates a user-scoped hosted Overlay (Basemap) record
     */
    async createBasemapOverlay(body: {
        name: string;
        url: string;
        type: string;
        format: string;
        minzoom?: number;
        maxzoom?: number;
        bounds?: [number, number, number, number];
        parent?: number;
    }): Promise<BasemapResponse> {
        const res = await fetch(new URL(`/api/basemap`, this.msg.api), {
            safeUrlAllow: [this.msg.api],
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt.sign({ access: 'user', email: this.msg.job.username }, this.msg.secret)}`,
            },
            body: JSON.stringify({
                ...body,
                overlay: true,
                protocol: 'hosted',
                scope: 'user',
            }),
        });

        if (!res.ok) throw new Error(await res.text());

        const basemap = await res.json() as BasemapResponse;

        await createImportResult(this.msg, {
            name: basemap.name,
            type: 'Basemap',
            type_id: String(basemap.id),
        });

        return basemap;
    }

    /**
     * Convert a GroundOverlay image into a georeferenced GeoTIFF by assigning
     * the corner coordinates as Ground Control Points and warping to EPSG:4326.
     * The GCP approach handles both axis-aligned LatLonBox overlays and
     * rotated LatLonBox / gx:LatLonQuad overlays with the same code path.
     */
    async georeferenceGroundOverlay(
        local: LocalMessage,
        overlay: GroundOverlaySource,
        index: number,
    ): Promise<string> {
        const normalized = path.resolve(local.tmpdir, `groundoverlay-${index}-normalized.png`);

        // Normalize exotic image formats and guarantee an alpha band so
        // rotated overlays warp with transparent corners
        await Sharp(overlay.image)
            .ensureAlpha()
            .png()
            .toFile(normalized);

        const { width, height } = await Sharp(normalized).metadata();
        if (!width || !height) throw new Error('Could not determine GroundOverlay image dimensions');

        const [ul, ur, lr, ll] = overlay.corners;

        const unreferenced = path.resolve(local.tmpdir, `groundoverlay-${index}-unreferenced.tif`);
        const georeferenced = path.resolve(local.tmpdir, `groundoverlay-${index}.tif`);

        cp.execFileSync('gdal', ['raster', 'convert', '--overwrite', normalized, unreferenced]);

        cp.execFileSync('gdal', [
            'raster', 'edit',
            '--crs', 'EPSG:4326',
            '--gcp', `0,0,${ul[0]},${ul[1]}`,
            '--gcp', `${width},0,${ur[0]},${ur[1]}`,
            '--gcp', `${width},${height},${lr[0]},${lr[1]}`,
            '--gcp', `0,${height},${ll[0]},${ll[1]}`,
            unreferenced,
        ]);

        cp.execFileSync('gdal', [
            'raster', 'reproject',
            '--resampling', 'bilinear',
            '--output-crs', 'EPSG:4326',
            '--overwrite',
            unreferenced, georeferenced,
        ]);

        return georeferenced;
    }

    /**
     * GroundOverlays parsed from an uploaded KML/KMZ are imported as raster
     * Overlays (Basemap records) with a parent record referring back to the
     * main KMZ so they are grouped together.
     *
     * When the KMZ produced a vector tileset that tileset becomes the parent
     * Overlay - otherwise the first GroundOverlay acts as the parent for any
     * remaining overlays.
     *
     * @param local  - Local File Information Object for the source KML/KMZ
     * @param asset  - The Profile Asset created for the source KML/KMZ
     * @param result - The result of the Data Transform run on the source file
     */
    async processGroundOverlays(
        local: LocalMessage,
        asset: Asset,
        result: TransformResult,
    ): Promise<void> {
        const configRes = await fetch(new URL(`/api/config/tiles`, this.msg.api), {
            safeUrlAllow: [this.msg.api],
            method: 'GET',
        });

        if (!configRes.ok) throw new Error(await configRes.text());

        const tiles = await configRes.json() as { url: string };
        const tilesBase = tiles.url.replace(/\/+$/, '');

        let parent: number | undefined = undefined;

        if (result.pmtiles) {
            const basemap = await this.createBasemapOverlay({
                name: path.parse(this.msg.job.name).name.slice(0, 64),
                url: `${tilesBase}/tiles/profile/${this.msg.job.username}/${asset.id}/tiles/{z}/{x}/{y}.mvt?token=${this.tileToken(asset.id)}`,
                type: 'vector',
                format: 'mvt',
                minzoom: 0,
                maxzoom: 14,
            });

            parent = basemap.id;
        }

        for (let i = 0; i < result.groundOverlays.length; i++) {
            const overlay = result.groundOverlays[i];

            try {
                const name = (overlay.name || `${path.parse(this.msg.job.name).name} Overlay ${i + 1}`)
                    .replace(/[/\\]/g, ' ')
                    .trim()
                    .slice(0, 64);

                const georeferenced = await this.georeferenceGroundOverlay(local, overlay, i);

                const childAsset = await this.processFile({
                    id: randomUUID(),
                    tmpdir: local.tmpdir,
                    ext: '.tif',
                    name: `${name}.tif`,
                    raw: georeferenced,
                });

                if (!childAsset) throw new Error('GroundOverlay asset could not be created');

                const basemap = await this.createBasemapOverlay({
                    name,
                    url: `${tilesBase}/tiles/profile/${this.msg.job.username}/${childAsset.id}/tiles/{z}/{x}/{y}.png?token=${this.tileToken(childAsset.id)}`,
                    type: 'raster',
                    format: 'png',
                    bounds: overlay.bounds,
                    parent,
                });

                if (parent === undefined) parent = basemap.id;
            } catch (err) {
                console.error(`Import: ${this.msg.job.id} - GroundOverlay "${overlay.name || i}" failed:`, err);
            }
        }
    }

    /**
     * XML Files are typeically TAK Native documents describing how to import data into TAK
     * This function processes the XML file, determines the type and processes it accordingly
     *
     * @param dp    - The DataPackage container
     * @param file  - The file path of the XML document
     */
    async processIndex(
        pkg: DataPackage,
        file: string,
    ): Promise<void> {
        const xml = (await pkg.getFileBuffer(file)).toString();

        await this.processIconset(xml, pkg);
        await this.processBasemap(xml);
    }

    async processIconset(
        xml: string,
        pkg: DataPackage,
    ): Promise<void> {
        try {
            const iconset = await Iconset.parse(xml);

            const check = await fetch(new URL(`/api/iconset/${iconset.uid}`, this.msg.api), {
                safeUrlAllow: [this.msg.api],
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${jwt.sign({ access: 'user', email: this.msg.job.username }, this.msg.secret)}`,
                },
            });

            if (check.status === 200) {
                throw new Error(`Iconset ${iconset.name} (${iconset.uid}) already exists`);
            }

            const iconset_req = await fetch(new URL(`/api/iconset`, this.msg.api), {
                safeUrlAllow: [this.msg.api],
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${jwt.sign({ access: 'user', email: this.msg.job.username }, this.msg.secret)}`,
                },
                body: JSON.stringify(iconset.to_json()),
            });

            if (!iconset_req.ok) throw new Error(await iconset_req.text());

            await createImportResult(this.msg, {
                name: iconset.name,
                type: 'Iconset',
                type_id: iconset.uid,
            });

            // Someone decided that the icon name should be the name without the folder prefix
            // This was a dumb idea and this code tries to match 1:1 without the prefix
            if (pkg) {
                const files = await pkg.files();
                const lookup = new Map();

                for (const file of files) {
                    if (!['.png', '.svg'].includes(path.parse(file).ext)) {
                        continue;
                    }

                    lookup.set(path.parse(file).base, file);
                }

                for (const icon of iconset.icons()) {
                    const ext = path.parse(icon.name).ext;

                    let prefix = 'data:';
                    if (ext === '.png') {
                        prefix += 'image/png;base64,';
                    } else if (ext === '.svg') {
                        prefix += 'image/svg+xml;base64,';
                    } else {
                        console.warn(`Iconset ${iconset.name} (${iconset.uid}) - Unsupported icon type for ${icon.name}: ${ext}`);
                        continue;
                    }

                    const icon_req = await fetch(new URL(`/api/iconset/${iconset.uid}/icon`, this.msg.api), {
                        safeUrlAllow: [this.msg.api],
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${jwt.sign({ access: 'user', email: this.msg.job.username }, this.msg.secret)}`,
                        },
                        body: JSON.stringify({
                            name: lookup.get(icon.name),
                            path: `${iconset.uid}/${lookup.get(icon.name)}`,
                            type2525b: icon.type2525b || null,
                            data: `${prefix}${(await pkg.getFileBuffer(lookup.get(icon.name))).toString('base64')}`,
                        }),
                    });

                    if (!icon_req.ok) console.error(await icon_req.text());
                }
            }
        } catch (err) {
            console.log(`Import: ${this.msg.job.id} - Is not an Iconset:`, err instanceof Error ? err.message : String(err));
        }
    }

    async processBasemap(
        xml: string,
    ): Promise<void> {
        try {
            const basemap = await Basemap.parse(xml);
            const json = basemap.to_json();
            const format = this.normalizeBasemapFormat(json.tileType);

            const basemap_req = await fetch(new URL(`/api/basemap`, this.msg.api), {
                safeUrlAllow: [this.msg.api],
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${jwt.sign({ access: 'user', email: this.msg.job.username }, this.msg.secret)}`,
                },
                body: JSON.stringify({
                    name: json.name,
                    url: json.url,
                    minzoom: json.minZoom,
                    maxzoom: json.maxZoom,
                    protocol: 'zxy',
                    format,
                }),
            });

            if (!basemap_req.ok) {
                console.error(await basemap_req.text());
            } else {
                const prod = await basemap_req.json() as BasemapResponse;

                await createImportResult(this.msg, {
                    name: prod.name,
                    type: 'Basemap',
                    type_id: String(prod.id),
                });
            }
        } catch (err) {
            console.log(`Import: ${this.msg.job.id} - Is not a Basemap:`, err instanceof Error ? err.message : String(err));
        }
    }
}
