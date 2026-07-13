import fs from 'node:fs';
import { parseArgs } from 'node:util';
import express from 'express';
import Bulldozer from './stateful/initialization.js';
import type { WebSocketServer } from 'ws';
import buildApi from './stateless/server/api.js';
import { attachWebsocket, startHubRpc } from './stateful/server/hub.js';
import Config from './common/config.js';
import ServerManager from './common/server.js';
import wireLocal from './stateful/wire.js';
import wireRemote from './stateless/wire.js';
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
        wire: config => config.mode === 'api'
            ? wireRemote(config, config.hubUrl!)
            : wireLocal(config),
    });

    await server(config);
}

export default async function server(config: Config): Promise<ServerManager> {
    if (config.mode !== 'api') {
        if (config.StackName !== 'test' || process.env.CLOUDTAK_Mode === 'docker-compose') {
            await Bulldozer.fireItUp(config);
        }

        if (!config.nogeofence) await config.geofence.init();
        await config.conns.init();

        if (!config.noevents) await config.events.init(config.pg);
    }

    let app: express.Application;
    if (config.mode === 'hub') {
        app = express();
        app.disable('x-powered-by');
        app.get('/api', (req, res) => {
            res.json({
                version: pkg.version,
            });
        });
    } else {
        app = await buildApi(config);
    }

    const rpc = config.mode === 'hub' ? await startHubRpc(config) : undefined;

    return new Promise((resolve) => {
        const srv = app.listen(parseInt(process.env.PORT || '5001'), () => {
            if (!config.silent) {
                if (process.env.CLOUDTAK_Mode === 'docker-compose') {
                    console.log('ok - http://localhost:5000');
                } else {
                    const address = srv.address();
                    const port = address && typeof address === 'object' ? address.port : process.env.PORT || '5001';
                    console.log(`ok - http://localhost:${port}`);
                }
            }

            const sm = new ServerManager(srv, wss, config, {
                rpc,
            });

            return resolve(sm);
        });

        let wss: WebSocketServer | undefined;
        if (config.mode !== 'api') {
            wss = attachWebsocket(srv, config);
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

            if (config.mode !== 'api') {
                await config.geofence.close();
                await config.conns.close();
            }
        });
    });
}
