import Err from '@openaddresses/batch-error';
import ImportControl, { ImportModeEnum }  from './control/import.js';
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

export class ConnectionClient {
    config: ConnectionConfig;
    tak: TAK;
    retry: number;
    initial: boolean;

    retrying: boolean;

    constructor(
        config: ConnectionConfig,
        tak: TAK,
    ) {
        this.tak = tak;
        this.config = config;
        this.retry = 0;
        this.initial = true;
        this.retrying = false;
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

    constructor(config: Config) {
        super();

        this.closed = false;
        this.config = config;
        this.importControl = new ImportControl(config);

        this.sinks = new Sinks(config);
    }

    async close(): Promise<void> {
        this.closed = true;

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
            if (this.config.wsClients.has(String(conn.id))) {
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
                            await this.config.models.ProfileChat.generate({
                                username: String(conn.id),
                                chatroom: feat.properties.chat.senderCallsign,
                                sender_callsign: feat.properties.chat.senderCallsign,
                                sender_uid: feat.properties.chat.chatgrp._attributes.uid0,
                                message_id: feat.properties.chat.messageId || randomUUID(),
                                message: feat.properties.remarks || ''
                            });
                        } else if (conn instanceof ProfileConnConfig && feat.properties.fileshare) {
                            const file = new URL(feat.properties.fileshare.senderUrl);

                            await this.importControl.create({
                                username: String(conn.id),
                                name: feat.properties.fileshare.name,
                                mode: ImportModeEnum.PACKAGE,
                                mode_id: file.searchParams.get('hash') || undefined
                            })
                        }
                    } catch (err) {
                        console.error('Failed to save COT: ', err);
                    }

                    for (const client of (this.config.wsClients.get(String(conn.id)) || [])) {
                        if (client.format == 'geojson') {
                            if (feat.properties && feat.properties.chat) {
                                client.ws.send(JSON.stringify({ type: 'chat', connection: conn.id, data: feat }));
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
        const tak = await TAK.connect(new URL(this.config.server.url), {
            key: connConfig.auth.key,
            cert: connConfig.auth.cert,
        },{
            id: connConfig.id
        });

        const connClient = new ConnectionClient(connConfig, tak);

        const api = await TAKAPI.init(new URL(String(this.config.server.api)), new APIAuthCertificate(connConfig.auth.cert, connConfig.auth.key));
        this.set(connConfig.id, connClient);

        tak.on('cot', async (cot: CoT) => {
            connClient.retry = 0;
            connClient.initial = false;

            this.cots(connConfig, [cot]);
        }).on('secureConnect', async () => {
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
        }).on('end', async () => {
            console.error(`not ok - ${connConfig.id} - ${connConfig.name} @ end`);
            if (!tak.destroyed) {
                this.retry(connClient);
            }
        }).on('timeout', async () => {
            console.error(`not ok - ${connConfig.id} - ${connConfig.name} @ timeout`);
            if (!tak.destroyed) {
                this.retry(connClient);
            }
        }).on('error', async (err) => {
            console.error(`not ok - ${connConfig.id} - ${connConfig.name} @ error:${err}`);
            if (!tak.destroyed) {
                this.retry(connClient);
            }
        });

        return connClient;
    }

    async retry(connClient: ConnectionClient): Promise<void> {
        if (connClient.retrying) {
            console.error(`ok - Not Retrying: ${connClient.config.id} - ${connClient.config.name} - Connection Already Retrying`);
            return;
        } else if (this.closed) {
            console.error(`ok - Not Retrying: ${connClient.config.id} - ${connClient.config.name} - Connection Pool Closed`);
            return;
        } else if (connClient.tak.destroyed) {
            console.error(`ok - Not Retrying: ${connClient.config.id} - ${connClient.config.name} - Connection Destroyed`);
            return;
        }

        connClient.retrying = true;

        const retryms = Math.min(connClient.retry * 1000, 15000);
        if (connClient.retry <= 15) connClient.retry++
        console.log(`not ok - ${connClient.config.uid()} - ${connClient.config.name} - retrying in ${retryms}ms`)
        await sleep(retryms);

        if (connClient.tak.destroyed) {
            console.log('ok - TAK Client has been closed - not retrying');
            connClient.retrying = false;
            return;
        } else {
            connClient.retrying = false
            await connClient.tak.reconnect();
        }
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
