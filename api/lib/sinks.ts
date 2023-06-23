//@ts-ignore
import Connection from './types/connection.js';
import fsp from 'node:fs/promises';
import path from 'node:path';
//@ts-ignore
import { Pool } from '@openaddresses/batch-generic';
import { XML as COT } from '@tak-ps/node-cot';
import Sink from './sink.js';

export default class Sinks extends Map<string, Sink> {
    pool: Pool;

    constructor(pool: Pool) {
        super();
        this.pool = pool;

    }

    async init() {
        for (const r of await fsp.readdir(new URL('./sinks/', import.meta.url))) {
            const sink: Sink = await import(path.resolve('./lib/sinks/', r))
            console.error(sink);
            //this.set(sink.type, sink);
        }
    }

    async cot(conn: Connection, cot: COT) {
        return true;
    }
}
