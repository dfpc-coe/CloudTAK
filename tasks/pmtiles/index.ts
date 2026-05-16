import express from 'express';
import Schema from '@openaddresses/batch-schema';
import cors from 'cors';
import serverless from '@tak-ps/serverless-http';
import fs from 'node:fs';
import { parseArgs } from 'node:util';

if (import.meta.url === `file://${process.argv[1]}`) {
    const { values: args } = parseArgs({
        args: process.argv.slice(2),
        options: {
            silent: { type: 'boolean' },   // Turn off logging as much as possible
            env: { type: 'string' }        // Load a non-default .env file --env local would read .env-local
        },
        allowPositionals: true,
        strict: false,
    }) as { values: CliArgs };

    try {
        const dotfile = new URL(`.env${args.env ? '-' + args.env : ''}`, import.meta.url);

        fs.accessSync(dotfile);

        process.env = Object.assign(JSON.parse(String(fs.readFileSync(dotfile))), process.env);
    } catch (err) {
        if (err instanceof Error && err.message.startsWith('ENOENT')) {
            console.log('ok - no .env file loaded - none found');
        } else {
            console.log('ok - no .env file loaded', err);
        }
    }
}

if (!process.env.SigningSecret) throw new Error('SigningSecret env var must be provided');
if (!process.env.ASSET_BUCKET) throw new Error('ASSET_BUCKET env var must be provided');
if (!process.env.PMTILES_URL) process.env.PMTILES_URL = 'http://localhost:5002';

if (!process.env.AWS_REGION) {
    process.env.AWS_REGION = 'us-east-1';
}

type CliArgs = {
    silent?: boolean;
    env?: string;
};

export const app = express();
const config = {};

const schema = new Schema(express.Router(), {
    logging: true,
    limit: 50
});

app.disable('x-powered-by');

app.use(cors({
    origin: '*',
    allowedHeaders: [
        'ETAG',
        'Content-Type',
        'Content-Length',
        'Cache-Control',
        'Authorization',
        'User-Agent',
        'x-requested-with'
    ],
    credentials: true
}));

app.use(schema.router);
app.use('/api', schema.router);

await schema.api();

await schema.load(
    new URL('./routes/', import.meta.url),
    config,
    {
        silent: !!process.env.StackName
    }
);

console.error(schema);

export const handler = serverless(app, {
    binary: ['application/x-protobuf', 'application/vnd.mapbox-vector-tile', 'image/png', 'image/jpeg', 'image/webp']
});

const startServer = async () => {
    app.listen(5002, () => {
        console.log('ok - tile server on http://localhost:5002');
    });
};

startServer();

