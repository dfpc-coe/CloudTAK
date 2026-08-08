import { Static, Type } from '@sinclair/typebox';
import type { Feature } from 'geojson';
import type { Connection } from './schema.js';
import { CoreEvent } from './schema.js';
import { InferSelectModel, and, eq, sql } from 'drizzle-orm';
import ConnectionControl from './control/connection.js';
import type ConfigStateful from '../stateful/config.js';
import type TAK from '@tak-ps/node-tak';
import type { TAKAPI } from '@tak-ps/node-tak';
import CoT, { CoTParser } from '@tak-ps/node-cot';

export const ConnectionAuth = Type.Object({
    ca: Type.Optional(Type.Array(Type.String())),
    cert: Type.String({
        minLength: 1,
        maxLength: 4096,
        description: 'PEM formatted client certificate',
    }),
    key: Type.String({
        minLength: 1,
        maxLength: 4096,
        description: 'PEM formatted private key',
    }),
});

export type MissionSub = {
    name: string;
    token: string | null;
};

export default interface ConnectionConfig {
    id: string | number;
    name: string;
    enabled: boolean;
    auth: Static<typeof ConnectionAuth>;
    config: ConfigStateful;

    subscription: (name: string) => Promise<null | MissionSub>;
    subscriptions: () => Promise<Array<MissionSub>>;

    geofences(): Promise<Array<Feature>>;
    geofence(id: string): Promise<Feature | null>;

    uid(): string;
}

/**
 * Implemented by Connection types that periodically submit active Core
 * Events to the TAK Server as CoTs scoped via Marti dest group entries
 */
export interface CoreEventSubmitter {
    /** Guards against overlapping submission runs */
    submittingEvents: boolean;

    eventInterval?: ReturnType<typeof setInterval>;

    startEvents(tak: TAK, api: TAKAPI): void;
    stopEvents(): void;
    submitEvents(tak: TAK, api: TAKAPI, opts?: { event?: string }): Promise<void>;
}

export function isCoreEventSubmitter(config: ConnectionConfig): config is ConnectionConfig & CoreEventSubmitter {
    const submitter = config as Partial<CoreEventSubmitter>;
    return typeof submitter.submitEvents === 'function'
        && typeof submitter.startEvents === 'function'
        && typeof submitter.stopEvents === 'function';
}

export class MachineConnConfig implements ConnectionConfig {
    id: number;
    name: string;
    enabled: boolean;
    auth: Static<typeof ConnectionAuth>;
    config: ConfigStateful;

    constructor(config: ConfigStateful, connection: InferSelectModel<typeof Connection>) {
        this.config = config;
        this.id = connection.id;
        this.name = connection.name;
        this.enabled = connection.enabled;
        this.auth = connection.auth;
    }

    uid(): string {
        return ConnectionControl.uid(this.auth.cert);
    }

    async subscription(name: string): Promise<null | MissionSub> {
        const missions = await this.config.models.Data.list({
            where: sql`
                name = ${name}
                AND connection = ${this.id}::INT
                AND mission_sync IS True
            `,
        });

        if (missions.items.length === 0) {
            return null;
        }

        return {
            name: missions.items[0].name,
            token: missions.items[0].mission_token,
        };
    }

    async subscriptions(): Promise<Array<MissionSub>> {
        const missions = await this.config.models.Data.list({
            where: sql`
                connection = ${this.id}::INT
                AND mission_sync IS True
            `,
        });

        return missions.items.map((m) => {
            return { name: m.name, token: m.mission_token };
        });
    }

    async geofences(): Promise<Array<Feature>> {
        const features = await this.config.models.ConnectionFeature.list({
            where: sql`
                connection = ${this.id}::INT
                AND enabled_geofence IS True
            `,
        });

        return (features || []).items.map((feature) => {
            return {
                ...feature,
                type: 'Feature',
            } as Feature;
        });
    }

    async geofence(id: string): Promise<Feature | null> {
        const feature = await this.config.models.ConnectionFeature.from(sql`
            connection = ${this.id}::INT
            AND enabled_geofence IS True
            AND id = ${id}
        `);

        return {
            ...feature,
            type: 'Feature',
        } as Feature;
    }
}

export class ProfileConnConfig implements ConnectionConfig {
    id: string;
    name: string;
    enabled: boolean;
    auth: Static<typeof ConnectionAuth>;
    config: ConfigStateful;

    constructor(
        config: ConfigStateful,
        email: string,
        auth: Static<typeof ConnectionAuth>,
    ) {
        this.config = config;
        this.id = email;
        this.name = email;
        this.enabled = true;
        this.auth = auth;
    }

    uid(): string {
        return `ANDROID-CloudTAK-${this.id}`;
    }

    async subscription(name: string): Promise<null | MissionSub> {
        const missions = await this.config.models.ProfileOverlay.list({
            where: sql`
                name = ${name}
                AND mode = 'mission'
                AND username = ${this.id}
            `,
        });

        if (missions.items.length === 0) {
            return null;
        }

        return {
            name: missions.items[0].name,
            token: missions.items[0].token,
        };
    }

    async subscriptions(): Promise<Array<MissionSub>> {
        const missions = await this.config.models.ProfileOverlay.list({
            where: sql`
                mode = 'mission'
                AND username = ${this.id}
            `,
        });

        return missions.items.map((m) => {
            return { name: m.name, token: m.token };
        });
    }

    async geofences(): Promise<Array<Feature>> {
        const features = await this.config.models.ProfileFeature.list({
            where: sql`
                username = ${this.id}
                AND enabled_geofence IS True
            `,
        });

        return (features || []).items.map((feature) => {
            return {
                ...feature,
                type: 'Feature',
            } as Feature;
        });
    }

    async geofence(id: string): Promise<Feature | null> {
        const feature = await this.config.models.ProfileFeature.from(sql`
            username = ${this.id}
            AND enabled_geofence IS True
            AND id = ${id}
        `);

        return {
            ...feature,
            type: 'Feature',
        } as Feature;
    }
}

export class AdminConnConfig implements ConnectionConfig, CoreEventSubmitter {
    id: number;
    name: string;
    enabled: boolean;
    auth: Static<typeof ConnectionAuth>;
    config: ConfigStateful;

    submittingEvents: boolean;
    eventInterval?: ReturnType<typeof setInterval>;

    constructor(config: ConfigStateful) {
        this.config = config;
        this.id = 0;
        this.name = 'admin';
        this.enabled = config.server.connection;
        this.auth = {
            cert: config.server.auth.cert!,
            key: config.server.auth.key!,
        };

        this.submittingEvents = false;
    }

    uid(): string {
        return ConnectionControl.uid(this.auth.cert);
    }

    startEvents(tak: TAK, api: TAKAPI): void {
        this.stopEvents();

        this.eventInterval = setInterval(() => {
            this.submitEvents(tak, api).catch((err) => {
                console.error(`not ok - ${this.id} - ${this.name} - failed to submit Core Events:`, err);
            });
        }, 10000);

        this.eventInterval.unref();
    }

    stopEvents(): void {
        if (this.eventInterval) {
            clearInterval(this.eventInterval);
            this.eventInterval = undefined;
        }
    }

    async submitEvents(tak: TAK, api: TAKAPI, opts?: { event?: string }): Promise<void> {
        if (this.submittingEvents || !tak.open) return;

        this.submittingEvents = true;

        try {
            const groups = new Map<number, string>();
            for (const group of (await api.Group.list({ useCache: true })).data) {
                groups.set(group.bitpos, group.name);
            }

            const cots: CoT[] = [];

            for await (const event of this.config.models.CoreEvent.augmented_iter({
                // Broadcast CoTs carry Channels, never Board placements
                boards: false,
                where: opts && opts.event
                    ? and(eq(CoreEvent.active, true), eq(CoreEvent.id, opts.event))
                    : eq(CoreEvent.active, true),
            })) {
                const dest = event.channels
                    .map(channel => groups.get(channel))
                    .filter((group): group is string => group !== undefined)
                    .map(group => ({ group }));

                // An Event with no resolvable Channels would otherwise be
                // broadcast to every Channel the Admin cert can see
                if (!dest.length) continue;

                // The `p` (parent) Link carries the Event UUID so a CloudTAK
                // client can open the Event a marker was generated from
                const links: Array<Record<string, string>> = [{
                    relation: 'p',
                    type: 'core-event',
                    event: event.id,
                    url: `${this.config.API_URL}/event/${event.id}`,
                    remarks: event.name,
                }];

                // `r-u` (refinement url) links render in ATAK as tappable
                // external links
                for (const link of event.links) {
                    if (!link.url) continue;

                    links.push({
                        relation: 'r-u',
                        mime: 'text/html',
                        url: link.url,
                        remarks: link.name,
                    });
                }

                const remarks = [
                    `Location:\n${event.location}`,
                    `Priority:\n${event.priority}`,
                ];

                if (event.remarks) remarks.push(event.remarks);

                try {
                    // node-cot converts a numeric 2525E SIDC type to a CoT
                    // Atom type, retaining the SIDC in a milsym entry
                    cots.push(await CoTParser.from_geojson({
                        id: event.id,
                        type: 'Feature',
                        properties: {
                            ...event.style,
                            type: event.type,
                            // Machine generated - clients disallow editing the
                            // Event as a plain CoT
                            how: 'm-g',
                            callsign: event.name,
                            remarks: remarks.join('\n\n'),
                            stale: 30 * 60 * 1000,
                            dest,
                            links,
                        },
                        geometry: event.geometry,
                    }));
                } catch (err) {
                    console.error(`not ok - ${this.id} - ${this.name} - failed to convert Core Event ${event.id} to CoT: ${err instanceof Error ? err.message : String(err)}`);
                }
            }

            if (cots.length) {
                tak.write(cots);
            }
        } finally {
            this.submittingEvents = false;
        }
    }

    async subscription(): Promise<null | MissionSub> {
        return null;
    }

    async subscriptions(): Promise<Array<MissionSub>> {
        return [];
    }

    async geofences(): Promise<Array<Feature>> {
        return [];
    }

    async geofence(): Promise<Feature | null> {
        return null;
    }
}
