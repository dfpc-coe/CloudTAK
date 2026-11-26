import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import tar from 'tar-stream';
import { Busboy } from '@fastify/busboy';
import Err from '@openaddresses/batch-error';
import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import * as Default from './limits.js';

export const PLUGIN_API_VERSION = 1;
const BUNDLE_MAX_BYTES = 25 * 1024 * 1024;

const LOGO_MAX_LENGTH = 100_000;
const MANIFEST = 'manifest.json';
const INDEX = 'index.js';

export const PluginManifest = Type.Object({
    name: Default.NameField,
    version: Type.String({
        minLength: 1,
        maxLength: 64,
        pattern: '^[a-zA-Z0-9][a-zA-Z0-9._+-]*$',
        description: 'Version of the Plugin bundle',
    }),
    description: Type.Optional(Default.DescriptionField),
    author: Type.Optional(Type.String({
        maxLength: 256,
        description: 'Person or organisation that publishes the Plugin',
    })),
    license: Type.Optional(Type.String({
        maxLength: 64,
        description: 'SPDX license identifier',
    })),
    homepage: Type.Optional(Type.String({
        maxLength: 512,
        pattern: '^https?://',
        description: 'Website or source repository of the Plugin',
    })),
    logo: Type.Optional(Type.String({
        maxLength: LOGO_MAX_LENGTH,
        pattern: '^data:image/(png|jpeg|webp|svg\\+xml);base64,[A-Za-z0-9+/]+=*$',
        description: 'Logo as a base64 data URI',
    })),
    sha256: Type.String({
        pattern: '^[a-f0-9]{64}$',
        description: 'SHA-256 of index.js',
    }),
    api_version: Type.Optional(Type.Integer({
        minimum: 1,
        description: 'Version of the CloudTAK Plugin API the bundle was built against',
    })),
});

export type PluginBundle = {
    manifest: Static<typeof PluginManifest>;
    index: Buffer;
};

function parseManifest(raw: Buffer): Static<typeof PluginManifest> {
    let manifest: unknown;

    try {
        manifest = JSON.parse(raw.toString('utf8'));
    } catch {
        throw new Err(400, null, `${MANIFEST} is not valid JSON`);
    }

    if (!Value.Check(PluginManifest, manifest)) {
        const first = Value.Errors(PluginManifest, manifest).First();
        throw new Err(400, null, `Invalid ${MANIFEST}: ${first ? `${first.path || '/'} ${first.message}` : 'unknown error'}`);
    }

    if ((manifest.api_version ?? PLUGIN_API_VERSION) > PLUGIN_API_VERSION) {
        throw new Err(400, null, `Plugin requires API version ${manifest.api_version} but this server supports ${PLUGIN_API_VERSION}`);
    }

    return manifest;
}

/**
 * Read a gzipped tar containing exactly manifest.json and index.js at its root
 */
async function readBundle(input: Readable): Promise<PluginBundle> {
    const gunzip = zlib.createGunzip();
    const extract = tar.extract();
    const files = new Map<string, Buffer>();
    let total = 0;

    input.once('error', (err) => gunzip.destroy(err));
    input.pipe(gunzip);

    const piped = pipeline(gunzip, extract).catch((err: unknown) => err);

    try {
        for await (const entry of extract) {
            const name = entry.header.name.replace(/^\.\//, '');

            if (entry.header.type !== 'file' || ![MANIFEST, INDEX].includes(name)) {
                throw new Err(400, null, `Unexpected bundle entry: ${entry.header.name}`);
            } else if (files.has(name)) {
                throw new Err(400, null, `Duplicate bundle entry: ${name}`);
            }

            const chunks: Buffer[] = [];
            for await (const chunk of entry as AsyncIterable<Buffer>) {
                total += chunk.length;
                if (total > BUNDLE_MAX_BYTES) throw new Err(400, null, `Bundle exceeds ${BUNDLE_MAX_BYTES} bytes`);
                chunks.push(chunk);
            }

            files.set(name, Buffer.concat(chunks));
        }

        const pipeError = await piped;
        if (pipeError) throw pipeError;
    } catch (err) {
        input.unpipe(gunzip);
        input.resume();
        gunzip.destroy();

        if (err instanceof Err) throw err;
        throw new Err(400, err instanceof Error ? err : new Error(String(err)), 'Bundle is not a valid .tar.gz archive');
    }

    const manifest = files.get(MANIFEST);
    const index = files.get(INDEX);

    if (!manifest) throw new Err(400, null, `Bundle is missing ${MANIFEST}`);
    if (!index || !index.length) throw new Err(400, null, `Bundle is missing ${INDEX}`);

    const parsed = parseManifest(manifest);

    if (createHash('sha256').update(index).digest('hex') !== parsed.sha256) {
        throw new Err(400, null, `${INDEX} does not match the sha256 in ${MANIFEST}`);
    }

    return {
        manifest: parsed,
        index,
    };
}

/**
 * Read the Plugin bundle out of a multipart upload
 */
export function readUpload(req: IncomingMessage): Promise<PluginBundle> {
    const contentType = req.headers['content-type'];

    if (!contentType?.startsWith('multipart/form-data')) {
        throw new Err(400, null, 'Unsupported Content-Type');
    }

    return new Promise((resolve, reject) => {
        const bb = new Busboy({
            headers: {
                'content-type': contentType,
            },
            limits: {
                files: 1,
                fileSize: BUNDLE_MAX_BYTES,
            },
        });

        let bundle: Promise<PluginBundle | undefined> | undefined;
        let error: unknown;

        bb.on('file', (fieldname, file, filename) => {
            if (!/\.(tar\.gz|tgz)$/i.test(filename || '')) {
                error = new Err(400, null, 'Only .tar.gz bundles can be uploaded');
                file.resume();
                return;
            }

            file.on('limit', () => {
                error = new Err(400, null, `Bundle exceeds ${BUNDLE_MAX_BYTES} bytes`);
            });

            bundle = readBundle(file).catch((err: unknown) => {
                error ??= err;
                return undefined;
            });
        }).on('error', (err) => {
            req.unpipe(bb);
            req.resume();

            reject(new Err(400, err instanceof Error ? err : new Error(String(err)), 'Malformed multipart upload'));
        }).on('finish', async () => {
            const read = await bundle;

            if (error) reject(error);
            else if (!read) reject(new Err(400, null, 'No Bundle Provided'));
            else resolve(read);
        });

        req.pipe(bb);
    });
}
