import fs from 'node:fs';
import { parseArgs } from 'node:util';
import express from 'express';
import Bulldozer from './stateful/lib/initialization.js';
import type { WebSocketServer } from 'ws';
import buildApi from './stateless/lib/server/api.js';
import { attachWebsocket, startHubRpc } from './stateful/lib/server/hub.js';
import type { ServerMode } from './common/config.js';
import ConfigStateful from './stateful/config.js';
import ConfigStateless from './stateless/config.js';
import ServerManager from './common/server.js';
import process from 'node:process';

type CliArgs = {
    silent?: boolean;
    nocache?: boolean;
    noevents?: boolean;
    nosinks?: boolean;
    nogeofence?: boolean;
    postgres?: string;
    env?: string;
};

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
    },
    allowPositionals: true,
    strict: false,
}) as { values: CliArgs };

const pkg = JSON.parse(String(fs.readFileSync(new URL('./package.json', import.meta.url))));

process.on('uncaughtExceptionMonitor', (exception, origin) => {
    console.trace('FATAL', exception, origin);
});

export type ServerConfigs = {
    stateful?: ConfigStateful;
    stateless?: ConfigStateless;
};

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

    const envArgs = {
        silent: args.silent || false,
        noevents: args.noevents || false,
        postgres: process.env.POSTGRES || args.postgres || 'postgres://postgres@localhost:5432/tak_ps_etl',
        nosinks: args.nosinks || false,
        nogeofence: args.nogeofence || false,
        nocache: args.nocache || false,
    };

    const mode = (process.env.CLOUDTAK_Server_Mode || 'both') as ServerMode;

    // Each config bootstraps its own database pool. Migrations only run from
    // the stateful config (single instance); construct it first so the schema
    // is current before the stateless side connects
    const stateful = mode !== 'api' ? await ConfigStateful.env(envArgs) : undefined;
    const stateless = mode !== 'hub'
        ? await ConfigStateless.env(envArgs, stateful ? { hub: stateful.hub } : {})
        : undefined;

    await server({ stateful, stateless });
}

export default async function server(configs: ServerConfigs): Promise<ServerManager> {
    const { stateful, stateless } = configs;

    if (!stateful && !stateless) throw new Error('server() requires a stateful and/or stateless Config');

    const primary = (stateless || stateful)!;

    if (stateful) {
        if (stateful.StackName !== 'test' || process.env.CLOUDTAK_Mode === 'docker-compose') {
            await Bulldozer.fireItUp(stateful);
        }

        if (!stateful.nogeofence) await stateful.geofence.init();
        await stateful.conns.init();

        if (!stateful.noevents) await stateful.events.init(stateful.pg);
    }

    let app: express.Application;
    if (!stateless) {
        app = express();
        app.disable('x-powered-by');
        app.get('/api', (req, res) => {
            res.json({
                version: pkg.version,
            });
        });
    } else {
        app = await buildApi(stateless);
    }

    const rpc = stateful && !stateless ? await startHubRpc(stateful) : undefined;

    return new Promise((resolve) => {
        const srv = app.listen(parseInt(process.env.PORT || '5001'), () => {
            if (!primary.silent) {
                if (process.env.CLOUDTAK_Mode === 'docker-compose') {
                    console.log('ok - http://localhost:5000');
                } else {
                    const address = srv.address();
                    const port = address && typeof address === 'object' ? address.port : process.env.PORT || '5001';
                    console.log(`ok - http://localhost:${port}`);
                }
            }

            const sm = new ServerManager(srv, wss, configs, {
                rpc,
            });

            return resolve(sm);
        });

        let wss: WebSocketServer | undefined;
        if (stateful) {
            wss = attachWebsocket(srv, stateful);
        } else {
            srv.on('upgrade', (request, socket) => {
                socket.on('error', () => socket.destroy());
                socket.write('HTTP/1.1 426 Upgrade Required\r\nConnection: close\r\n\r\n');
                socket.destroy();
            });
        }

        srv.on('close', async () => {
            if (rpc) {
                rpc.close();
            }

            if (stateful) {
                await stateful.geofence.close();
                await stateful.conns.close();
            }
        });
    });
}
