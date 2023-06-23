//@ts-ignore
import Connection from './types/connection.js';
import fsp from 'node:fs/promises';
import path from 'node:path';
//@ts-ignore
import { Pool } from '@openaddresses/batch-generic';
import { XML as COT } from '@tak-ps/node-cot';
import Sink from './sink.js';
//@ts-ignore
import ConnectionSink from './types/connection-sink.js';
import ESRISink from './sinks/esri.js';
import HookQueue from './aws/hooks.js';

export default class Sinks extends Map<string, any> {
    pool: Pool;
    queue: HookQueue;

    constructor(pool: Pool) {
        super();
        this.pool = pool;
        this.queue = new HookQueue();

        // Include Supported Sink Types Here
        this.set('ArcGIS', ESRISink);
    }

    async cot(conn: Connection, cot: COT): Promise<boolean> {
        const sinks = (await ConnectionSink.list(this.pool, {
            connection: conn.id,
            enabled: true
        })).sinks;

        const queue = [];
        for (const sink of sinks) {
            this.queue.submit(conn.id, JSON.stringify({
                type: sink.type,
                body: sink.body,
                feat: cot.to_geojson()
            }));
        }

        return true;
    }
}
