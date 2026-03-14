import Err from '@openaddresses/batch-error';
import fs from 'node:fs';
import path from 'node:path';
import ImportControl, { ImportSourceEnum }  from './control/import.js';
import Sinks from './sinks.js';
import Config from './config.js';
import { randomUUID } from 'node:crypto';
import Modeler from '@openaddresses/batch-generic';
import { Connection } from './schema.js';
import sleep from './sleep.js';
import TAK, { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';
import CoT, { CoTParser } from '@tak-ps/node-cot';
import type ConnectionConfig from './connection-config.js';
import { MachineConnConfig, ProfileConnConfig } from './connection-config.js';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf-8')) as {
    version: string;
};

export class ConnectionClient {
    config: ConnectionConfig;
    tak: TAK;
    api: TAKAPI;
    retry: number;
    initial: boolean;

    retrying: boolean;

    /**
     * Set of bitpos integers representing the active channels
     * this connection is currently bound to
     */
    channels: Set<number>;

    constructor(
        config: ConnectionConfig,
        tak: TAK,
        api: TAKAPI,
    ) {
        this.tak = tak;
        this.api = api;
        this.config = config;
        this.retry = 0;
        this.initial = true;
        this.retrying = false;
        this.channels = new Set();
    }

    /**
     * Refresh the set of active channel bitpos integers
     * by querying the group list API
     */
    async refreshChannels(): Promise<void> {
        try {
            const list = await this.api.Group.list({ useCache: true });
            const active = new Set<number>();
            for (const group of list.data) {
                if (group.active) {
                    active.add(group.bitpos);
                }
            }
            this.channels = active;
            console.log(`ok - ${this.config.id} - ${this.config.name} - refreshed channels: [${[...active].join(', ')}]`);
        } catch (err) {
            console.error(`not ok - ${this.config.id} - ${this.config.name} - failed to refresh channels: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    destroy(): void {
        this.tak.destroy()
    }
}

/**
 * Maintain a pool of TAK Connections, reconnecting as necessary
 * @class
 */
export default class ConnectionPool extends Map<number | string, ConnectionClient> {
    config: Config;
    sinks: Sinks;
    importControl: ImportControl;
    closed: boolean;

    /**
     * In Low Bandwith environments the WebSocket can persist
     * even when the connection is not adequately transferring data
     *
     * A status message is sent every 5 seconds to ensure the client can
     * detect this and notify the user and/or attempt a reconnect
     */
    pingInterval: ReturnType<typeof setInterval>;

    constructor(config: Config) {
        super();

        this.closed = false;
        this.config = config;
        this.importControl = new ImportControl(config);

        this.sinks = new Sinks(config);

        this.pingInterval = setInterval(() => {
            try {
                for (const clients of this.config.wsClients.values()) {
                    for (const client of clients) {
                        client.ws.send(JSON.stringify({
                            type: 'status',
                            data: {
                                version: pkg.version,
                                time: new Date().toISOString(),
                            }
                        }));
                    }
                }
            } catch (err) {
                console.error('Failed to send ping: ', err);
            }
        }, 5000);

        this.pingInterval.unref();
    }

    async close(): Promise<void> {
        this.closed = true;

        clearInterval(this.pingInterval);

        for (const conn of this.values()) {
            conn.destroy();
        }

        this.clear();
    }

    async subscription(connection: number | string, name: string): Promise<{
        name: string;
        token?: string;
    }> {
        const conn = this.get(connection);
        if (!conn) return { name: name };
        const sub = await conn.config.subscription(name);
        if (!sub) return { name: name };
        return {
            name: sub.name,
            token: sub.token || undefined
        };
    }

    async refresh() {
        for (const conn of this.keys()) {
            this.delete(conn);
        }

        await this.init();
    }

    /**
     * Page through connections and start a connection for each one
     */
    async init(): Promise<void> {
        const conns: Promise<ConnectionClient>[] = [];

        const ConnectionModel = new Modeler(this.config.pg, Connection);
        for await (const conn of ConnectionModel.iter()) {
            if (conn.enabled) {
                conns.push(this.add(new MachineConnConfig(this.config, conn)));
            }
        }

        await Promise.all(conns);
    }

    status(id: number | string): string {
        const conn = this.get(id);

        if (conn) {
            return conn.tak.open ? 'live' : 'dead';
        } else {
            return 'unknown';
        }
    }

    /**
     * Handle writing a CoT into the Sink/WebSocket Clients
     * This is also called externally by the layer/:layer/cot API as CoTs
     * aren't rebroadcast to the submitter by the TAK Server
     */
    async cots(
        conn: ConnectionConfig,
        cots: CoT[],
    ) {
        try {
            if (conn instanceof ProfileConnConfig) {
                for (const cot of cots) {
                    // While I am reluncant to override user-intent, client's don't necessarily
                    // pass archived tags on the following types which lead to a poor experience
                    // on reloads if not present
                    // b-m-r Route COTs
                    if (['b-m-r'].includes(cot.type())) {
                        cot.archived(true);
                    }

                    const feat = await CoTParser.to_geojson(cot);

                    try {
                        if (conn instanceof ProfileConnConfig && feat.properties && feat.properties.chat) {
                            const myUid = `ANDROID-CloudTAK-${conn.id}`;
                            const senderUid = feat.properties.chat.chatgrp?._attributes?.uid0;
                            const isOutgoing = senderUid === myUid;
                            const chatroom = isOutgoing
                                ? feat.properties.chat.chatroom
                                : feat.properties.chat.senderCallsign;

                            await this.config.models.ProfileChat.generate({
                                username: String(conn.id),
                                chatroom: chatroom,
                                sender_callsign: feat.properties.chat.senderCallsign,
                                sender_uid: feat.properties.chat.chatgrp._attributes.uid0,
                                message_id: feat.properties.chat.messageId || randomUUID(),
                                message: feat.properties.remarks || ''
                            });
                        } else if (conn instanceof ProfileConnConfig && feat.properties.fileshare) {
                            const file = new URL(feat.properties.fileshare.senderUrl);

                            let name = feat.properties.fileshare.name;
                            const { ext } = path.parse(name);
                            if (!ext) name = name + '.zip'

                            await this.importControl.create({
                                username: String(conn.id),
                                name,
                                source: ImportSourceEnum.PACKAGE,
                                source_id: file.searchParams.get('hash') || undefined
                            })
                        }
                    } catch (err) {
                        console.error('Failed to save COT: ', err);
                    }

                    for (const client of (this.config.wsClients.get(String(conn.id)) || [])) {
                        if (client.format == 'geojson') {

                            if (feat.properties && feat.properties.chat && feat.properties.chat.parent === 'DataSyncMissionsList') {
                                console.log(JSON.stringify(feat));
                            }

                            if (feat.properties && feat.properties.chat && feat.properties.chat.parent !== 'DataSyncMissionsList') {
                                client.ws.send(JSON.stringify({
                                    type: 'chat',
                                    connection: conn.id,
                                    data: {
                                        chatroom: feat.properties.chat.chatroom,
                                        messageId: feat.properties.chat.messageId,
                                        from: {
                                            callsign: feat.properties.chat.senderCallsign,
                                        },
                                        message: feat.properties.remarks,
                                        time: feat.properties.time || new Date().toISOString()
                                    }
                                }));
                            } else if (feat.properties.type.startsWith("t-x")) {
                                client.ws.send(JSON.stringify({ type: 'task', connection: conn.id, data: feat }));
                            } else {
                                client.ws.send(JSON.stringify({ type: 'cot', connection: conn.id, data: feat }));
                            }
                        } else {
                            client.ws.send(JSON.stringify({ type: 'cot', connection: conn.id, data: cot.raw }));
                        }
                    }
                }
            }

            if (conn instanceof MachineConnConfig && !this.config.nosinks) {
                await this.sinks.cots(conn, cots);
            }
        } catch (err) {
            console.error('Error', err);
        }
    }

    async add(connConfig: ConnectionConfig): Promise<ConnectionClient> {
        if (!connConfig.auth || !connConfig.auth.cert || !connConfig.auth.key) throw new Err(400, null, 'Connection must have auth.cert & auth.key');

        let tak: TAK;

        if (this.config.StackName === 'test') {
            tak = await TAK.connect(new URL(this.config.server.url), {
                key: connConfig.auth.key,
                cert: connConfig.auth.cert,
                rejectUnauthorized: false,
                ca: this.config.server.auth.cert
            },{
                id: connConfig.id
            });
        } else {
            tak = await TAK.connect(new URL(this.config.server.url), {
                key: connConfig.auth.key,
                cert: connConfig.auth.cert,
            },{
                id: connConfig.id
            });
        }

        const api = await TAKAPI.init(new URL(String(this.config.server.api)), new APIAuthCertificate(connConfig.auth.cert, connConfig.auth.key));
        const connClient = new ConnectionClient(connConfig, tak, api);
        this.set(connConfig.id, connClient);

        tak.on('cot', async (cot: CoT) => {
            connClient.retry = 0;
            connClient.initial = false;

            if (cot.type() === 't-x-g-c') {
                await connClient.refreshChannels();
            }

            this.cots(connConfig, [cot]);
        }).on('secureConnect', async () => {
            await connClient.refreshChannels();
            for (const sub of await connConfig.subscriptions()) {
                let retry = true;
                do {
                    try {
                        await api.Mission.subscribe(sub.name, {
                            uid: connConfig.uid()
                        },{
                            token: sub.token || undefined
                        });

                        console.log(`Connection: ${connConfig.id} - Sync: ${sub.name}: Subscribed!`);
                        retry = false;
                    } catch (err) {
                        console.warn(`Connection: ${connConfig.id} (${connConfig.uid()}) - Sync: ${sub.name}: ${err instanceof Error ? err.message : String(err)}`);

                        if (err instanceof Error && err.message.includes('ECONNREFUSED')) {
                            await sleep(1000);
                        } else {
                            // We don't retry for unknown issues as it could be the Sync has been remotely deleted and will
                            // retry forwever
                            retry = false;
                        }
                    }
                } while (retry)
            }
        }).on('close', async () => {
            console.error(`not ok - ${connConfig.id} - ${connConfig.name} @ close`);
            if (this.isTracked(connClient)) {
                this.retry(connClient);
            }
        }).on('end', async () => {
            console.error(`not ok - ${connConfig.id} - ${connConfig.name} @ end`);
            if (this.isTracked(connClient)) {
                this.retry(connClient);
            }
        }).on('timeout', async () => {
            console.error(`not ok - ${connConfig.id} - ${connConfig.name} @ timeout`);
            if (this.isTracked(connClient)) {
                this.retry(connClient);
            }
        }).on('error', async (err) => {
            console.error(`not ok - ${connConfig.id} - ${connConfig.name} @ error:${err}`);
            if (this.isTracked(connClient)) {
                this.retry(connClient);
            }
        });

        return connClient;
    }

    /**
     * Determine whether a connection is still managed by the pool.
     */
    private isTracked(connClient: ConnectionClient): boolean {
        return this.has(connClient.config.id);
    }

    async retry(connClient: ConnectionClient): Promise<void> {
        if (connClient.retrying) {
            console.error(`ok - Not Retrying: ${connClient.config.id} - ${connClient.config.name} - Connection Already Retrying`);
            return;
        } else if (this.closed) {
            console.error(`ok - Not Retrying: ${connClient.config.id} - ${connClient.config.name} - Connection Pool Closed`);
            return;
        }

        connClient.retrying = true;

        const isFirstRetry = connClient.retry === 0;
        const nextRetry = Math.min(connClient.retry + 1, 15);
        const retryms = isFirstRetry ? 0 : Math.min(nextRetry * 1000, 15000);
        connClient.retry = nextRetry;

        console.log(`not ok - ${connClient.config.uid()} - ${connClient.config.name} - retrying in ${retryms}ms`)
        if (retryms > 0) await sleep(retryms);

        if (this.closed) {
            console.error(`ok - Not Retrying: ${connClient.config.id} - ${connClient.config.name} - Connection Pool Closed`);
            connClient.retrying = false;
            return;
        }

        if (!this.isTracked(connClient)) {
            console.log('ok - Connection no longer tracked - not retrying');
            connClient.retrying = false;
            return;
        }

        try {
            await connClient.tak.reconnect();
        } catch (err) {
            console.error(`not ok - ${connClient.config.id} - ${connClient.config.name} - reconnect failed: ${err instanceof Error ? err.message : String(err)}`);
            connClient.retrying = false;

            if (!this.closed && this.isTracked(connClient)) {
                await this.retry(connClient);
            }

            return;
        }

        connClient.retrying = false;
    }

    delete(id: number | string): boolean {
        const conn = this.get(id);

        if (conn) {
            conn.destroy();
            super.delete(id);

            return true;
        } else {
            return false;
        }
    }
}
