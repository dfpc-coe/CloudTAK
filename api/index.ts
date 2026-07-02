import fs from 'node:fs';
import { parseArgs } from 'node:util';
import stateless from './stateless.js';
import { initState, createWebSocketServer } from './state.js';
import type WebSocket from 'ws';
import Config from './lib/config.js';
import ServerManager from './lib/server.js';
import process from 'node:process';

type CliArgs = {
    silent?: boolean;
    nocache?: boolean;
    noevents?: boolean;
    nosinks?: boolean;
    nogeofence?: boolean;
    postgres?: string;
    env?: string;
    mode?: string;
};

export type ServerMode = 'state' | 'stateless';

const { values: args } = parseArgs({
    args: process.argv.slice(2),
    options: {
        silent: { type: 'boolean' }, // Turn off logging as much as possible
        nocache: { type: 'boolean' }, // Ignore MemCached
        noevents: { type: 'boolean' }, // Disable Initialization of Second Level Events
        nosinks: { type: 'boolean' }, // Disable Push to Sinks
        nogeofence: { type: 'boolean' }, // Disable Geofence Server Integration
        postgres: { type: 'string' }, // Postgres Connection String
        env: { type: 'string' }, // Load a non-default .env file --env local would read .env-local
        mode: { type: 'string' }, // Server Mode: state (default) or stateless
    },
    allowPositionals: true,
    strict: false,
}) as { values: CliArgs };

process.on('uncaughtExceptionMonitor', (exception, origin) => {
    console.trace('FATAL', exception, origin);
});

/**
 * Determine the mode the server should run in:
 * - `state`: (default) Stateful server - manages the TAK Connection Pool, terminates
 *      WebSockets & serves the full API. Horizontal scaling is limited to a single container
 * - `stateless`: Serves only the API/UI without any persistent state - can be scaled horizontally
 */
export function serverMode(mode?: string): ServerMode {
    const parsed = mode || process.env.CLOUDTAK_Server_Mode || 'state';

    if (!['state', 'stateless'].includes(parsed)) {
        throw new Error(`Invalid Server Mode: ${parsed} - must be "state" or "stateless"`);
    }

    return parsed as ServerMode;
}

if (import.meta.url === `file://${process.argv[1]}`) {
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

    const config = await Config.env({
        silent: args.silent || false,
        noevents: args.noevents || false,
        postgres: process.env.POSTGRES || args.postgres || 'postgres://postgres@localhost:5432/tak_ps_etl',
        nosinks: args.nosinks || false,
        nogeofence: args.nogeofence || false,
        nocache: args.nocache || false,
    });

    await server(config, {
        mode: serverMode(args.mode),
    });
}

export default async function server(
    config: Config,
    opts: {
        mode: ServerMode;
    } = {
        mode: 'state',
    },
): Promise<ServerManager> {
    if (opts.mode === 'state') {
        await initState(config);
    }

    const app = await stateless(config);

    const wss = opts.mode === 'state' ? createWebSocketServer(config) : undefined;

    return new Promise((resolve) => {
        const srv = app.listen(5001, () => {
            if (!config.silent) {
                console.log(`ok - mode: ${opts.mode}`);

                if (process.env.CLOUDTAK_Mode === 'docker-compose') {
                    console.log('ok - http://localhost:5000');
                } else {
                    console.log('ok - http://localhost:5001');
                }
            }

            const sm = new ServerManager(srv, config, wss);
            return resolve(sm);
        });

        if (wss) {
            srv.on('upgrade', (request, socket, head) => {
                wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
                    wss.emit('connection', ws, request);
                });
            });
        }

        srv.on('close', async () => {
            await config.geofence.close();
            await config.conns.close();
        });
    });
}
