//@ts-ignore
import Connection from './types/connection.js';
import fsp from 'node:fs/promises';
import path from 'node:path';
import Config from './config.js';
import { XML as COT } from '@tak-ps/node-cot';
import Sink from './sink.js';
//@ts-ignore
import ConnectionSink from './types/connection-sink.js';
import ESRISink from './sinks/esri.js';
import HookQueue from './aws/hooks.js';
import Cacher from './cacher.js';

export default class Sinks extends Map<string, any> {
    config: Config;
    queue: HookQueue;

    constructor(config: Config) {
        super();
        this.config = config;
        this.queue = new HookQueue();

        // Include Supported Sink Types Here
        this.set('ArcGIS', ESRISink);
    }

    async cot(conn: Connection, cot: COT): Promise<boolean> {
        const sinks = await config.cacher.get(Cacher.Miss(req.query, `connection-${conn.id}-sinks`), async () => {
            return await ConnectionSink.list(this.config.pool, { connection: conn.id, enabled: true })
        });

        const queue = [];
        for (const sink of sinks.sinks) {
            const handler = this.get(sink.type);

            const secrets = await handler.secrets();
            const feat = cot.to_geojson();

            console.error(secrets);
            this.queue.submit(conn.id, JSON.stringify({
                type: sink.type,
                body: sink.body,
                feat, secrets
            }));
        }

        return true;
    }
}
