#!/usr/bin/env tsx

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';

import Sinon from 'sinon';
import {
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
    CreateMultipartUploadCommand,
    UploadPartCommand,
    CompleteMultipartUploadCommand,
    AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

import Worker from './src/worker.ts';
import type { Message } from './src/types.ts';

function usage(): string {
    return [
        'Locally import a geospatial file through the real worker pipeline',
        '',
        'Usage:',
        '  ./cli.ts <path-to-geospatial-file> [output-directory]',
    ].join('\n');
}

async function toBuffer(body: unknown): Promise<Buffer> {
    if (Buffer.isBuffer(body)) return body;
    if (typeof body === 'string') return Buffer.from(body);
    if (body instanceof Uint8Array) return Buffer.from(body);
    if (body instanceof Readable) {
        const chunks: Buffer[] = [];
        for await (const chunk of body) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
    }

    throw new Error(`Unsupported S3 Body type: ${typeof body}`);
}

/**
 * Stub the S3 client so the worker's identical GetObject/PutObject/multipart
 * calls resolve locally. GetObject streams the input file; uploads are written
 * to the output directory using the S3 key as a relative path.
 */
function stubS3(inputPath: string, outputDir: string): void {
    const multipart = new Map<string, { key: string; parts: Map<number, Buffer> }>();

    const writeKey = async (key: string, body: unknown): Promise<void> => {
        const dest = path.resolve(outputDir, key);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        await fs.promises.writeFile(dest, await toBuffer(body));
        console.log(`ok - [s3] wrote ${key}`);
    };

    Sinon.stub(S3Client.prototype, 'send').callsFake(async (command: unknown) => {
        if (command instanceof GetObjectCommand) {
            return { Body: fs.createReadStream(inputPath) };
        }

        if (command instanceof PutObjectCommand) {
            await writeKey(command.input.Key as string, command.input.Body);
            return { ETag: '"local"' };
        }

        if (command instanceof CreateMultipartUploadCommand) {
            const uploadId = randomUUID();
            multipart.set(uploadId, { key: command.input.Key as string, parts: new Map() });
            return { UploadId: uploadId };
        }

        if (command instanceof UploadPartCommand) {
            const upload = multipart.get(command.input.UploadId as string);
            if (upload) {
                upload.parts.set(command.input.PartNumber as number, await toBuffer(command.input.Body));
            }
            return { ETag: `"${command.input.PartNumber}"` };
        }

        if (command instanceof CompleteMultipartUploadCommand) {
            const upload = multipart.get(command.input.UploadId as string);
            if (upload) {
                const ordered = Array.from(upload.parts.keys()).sort((a, b) => a - b);
                const body = Buffer.concat(ordered.map(n => upload.parts.get(n)!));
                await writeKey(upload.key, body);
                multipart.delete(command.input.UploadId as string);
            }
            return { Location: 'local' };
        }

        if (command instanceof AbortMultipartUploadCommand) {
            multipart.delete(command.input.UploadId as string);
            return {};
        }

        return {};
    });
}

/**
 * Intercept every CloudTAK API call the worker makes and answer with the
 * minimal valid response so the real pipeline runs end-to-end offline.
 */
function stubAPI(api: string): { restore: () => void } {
    const mockAgent = new MockAgent();
    const originalDispatcher = getGlobalDispatcher();

    // Mock only the CloudTAK API origin - allow every other origin (e.g. KML
    // NetworkLink fetches) to reach the real network.
    const apiHost = new URL(api).host;
    mockAgent.enableNetConnect(host => host !== apiHost);

    setGlobalDispatcher(mockAgent);

    const pool = mockAgent.get(api);

    const json = (statusCode: number, body: unknown) => ({
        statusCode,
        data: JSON.stringify(body),
        responseOptions: { headers: { 'content-type': 'application/json' } },
    });

    // Profile Asset creation - echo the generated id back
    pool.intercept({ path: /^\/api\/profile\/asset$/, method: 'POST' }).reply((opts) => {
        const body = JSON.parse(String(opts.body));
        return json(200, { id: body.id, name: body.name, artifacts: [] });
    }).persist();

    // Profile Asset updates (iconset + artifacts) - echo artifacts back
    pool.intercept({ path: /^\/api\/profile\/asset\/[^/?]+/, method: 'PATCH' }).reply((opts) => {
        const body = JSON.parse(String(opts.body));
        const id = String(opts.path).split('?')[0].split('/').pop();
        return json(200, { id, name: body.name || 'asset', artifacts: body.artifacts || [] });
    }).persist();

    // Profile Feature broadcast (DataPackage CoTs)
    pool.intercept({ path: /^\/api\/profile\/feature/, method: 'PUT' }).reply(() => {
        return json(200, { id: randomUUID() });
    }).persist();

    // Iconset existence check - report not found so creation proceeds
    pool.intercept({ path: /^\/api\/iconset\/[^/?]+$/, method: 'GET' }).reply(() => {
        return json(404, { message: 'Not Found' });
    }).persist();

    // Iconset creation
    pool.intercept({ path: /^\/api\/iconset$/, method: 'POST' }).reply((opts) => {
        const body = JSON.parse(String(opts.body));
        return json(200, { uid: body.uid || randomUUID(), name: body.name });
    }).persist();

    // Iconset icon upload
    pool.intercept({ path: /^\/api\/iconset\/[^/?]+\/icon/, method: 'POST' }).reply(() => {
        return json(200, {});
    }).persist();

    // Iconset regeneration
    pool.intercept({ path: /^\/api\/iconset\/[^/?]+\/regen/, method: 'POST' }).reply(() => {
        return json(200, {});
    }).persist();

    // Basemap creation
    pool.intercept({ path: /^\/api\/basemap$/, method: 'POST' }).reply((opts) => {
        const body = JSON.parse(String(opts.body));
        return json(200, { id: 1, name: body.name });
    }).persist();

    // Import result records
    pool.intercept({ path: /^\/api\/import\/[^/?]+\/result/, method: 'POST' }).reply(() => {
        return json(200, {});
    }).persist();

    return {
        restore: () => {
            setGlobalDispatcher(originalDispatcher);
            mockAgent.close();
        },
    };
}

async function main(): Promise<void> {
    const input = process.argv[2];

    if (!input || input === '-h' || input === '--help') {
        console.log(usage());
        process.exit(input ? 0 : 1);
    }

    const inputPath = path.resolve(process.cwd(), input);

    if (!fs.existsSync(inputPath) || !fs.statSync(inputPath).isFile()) {
        console.error(`Error: File not found: '${inputPath}'`);
        process.exit(1);
    }

    const name = path.basename(inputPath);

    const outputDir = process.argv[3]
        ? path.resolve(process.cwd(), process.argv[3])
        : path.resolve(process.cwd(), `output-${path.parse(name).name}`);

    fs.mkdirSync(outputDir, { recursive: true });

    const api = 'http://localhost:5001';

    const msg: Message = {
        api,
        bucket: 'local-bucket',
        secret: 'local-secret',
        job: {
            id: randomUUID(),
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            status: 'Running',
            error: null,
            result: {},
            name,
            username: 'local@cloudtak.local',
            source: 'Upload',
            config: {},
            source_id: null,
        } as unknown as Message['job'],
    };

    stubS3(inputPath, outputDir);
    const apiStub = stubAPI(api);

    console.log(`ok - importing ${name}`);
    console.log(`ok - output directory: ${outputDir}`);

    try {
        const worker = new Worker(msg);

        await new Promise<void>((resolve, reject) => {
            worker.on('success', () => resolve());
            worker.on('error', err => reject(err));
            worker.process().catch(reject);
        });

        console.log('ok - import complete');
    } finally {
        Sinon.restore();
        apiStub.restore();
    }
}

const isMainModule = process.argv[1]
    ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
    : false;

if (isMainModule) {
    main().catch((err) => {
        console.error('Error:', err instanceof Error ? err.message : String(err));
        process.exit(1);
    });
}
