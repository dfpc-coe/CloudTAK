import { Static, Type } from '@sinclair/typebox';
import type { Feature } from 'geojson';
import type { Connection } from './schema.js';
import { InferSelectModel, sql } from 'drizzle-orm';
import ConnectionControl from './control/connection.js';
import ProfileOverlayControl from './control/profile-overlay.js';
import type ConfigStateful from '../stateful/config.js';
import type TAK from '@tak-ps/node-tak';
import type { TAKAPI } from '@tak-ps/node-tak';
import CoT, { CoTParser } from '@tak-ps/node-cot';
import { LayerMapping_Destination } from './enums.js';
import { profileUid } from './control/takserver.js';

const EVENT_STALE = 30 * 60 * 1000;

/** Every located Entity is swept to the TAK Server once per interval and any one Entity is broadcast at most once per interval */
const ENTITY_INTERVAL = 10 * 1000;

/** A Device has no end - its marker lives for as long as the Device is broadcast */
const DEVICE_STALE = EVENT_STALE;

/** CoT stale in ms - capped at the Event's ended time so clients drop the marker when the Event ends */
function eventStale(ended: string | null): number {
    if (!ended) return EVENT_STALE;
    return Math.max(30 * 1000, Math.min(EVENT_STALE, new Date(ended).getTime() - Date.now()));
}

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
    guid: string | null;
    token: string | null;
};

export default interface ConnectionConfig {
    id: string | number;
    name: string;
    enabled: boolean;
    auth: Static<typeof ConnectionAuth>;
    config: ConfigStateful;

    subscription: (id: string) => Promise<null | MissionSub>;
    subscriptions: () => Promise<Array<MissionSub>>;

    geofences(): Promise<Array<Feature>>;
    geofence(id: string): Promise<Feature | null>;

    uid(): string;
}

/**
 * Implemented by Connection types that periodically submit located Core
 * Entities (active Events & Devices) to the TAK Server as CoTs scoped via
 * Marti dest group entries
 */
export interface CoreEntitySubmitter {
    /** Guards against overlapping submission runs */
    submittingEntities: boolean;

    entityInterval?: ReturnType<typeof setInterval>;

    startEntities(tak: TAK, api: TAKAPI): void;
    stopEntities(): void;
    submitEntities(tak: TAK, api: TAKAPI, opts?: { entity?: string }): Promise<void>;
}

export function isCoreEntitySubmitter(config: ConnectionConfig): config is ConnectionConfig & CoreEntitySubmitter {
    const submitter = config as Partial<CoreEntitySubmitter>;
    return typeof submitter.submitEntities === 'function'
        && typeof submitter.startEntities === 'function'
        && typeof submitter.stopEntities === 'function';
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
            guid: missions.items[0].mission_guid,
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
            return { name: m.name, guid: m.mission_guid, token: m.mission_token };
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
        return profileUid(this.id);
    }

    async subscription(guid: string): Promise<null | MissionSub> {
        const overlay = await new ProfileOverlayControl(this.config).mission(this.id, guid);
        if (!overlay) return null;
        return { name: overlay.name, guid: overlay.mode_id, token: overlay.token };
    }

    async subscriptions(): Promise<Array<MissionSub>> {
        const overlays = await new ProfileOverlayControl(this.config).missions(this.id);
        return overlays.map(m => ({ name: m.name, guid: m.mode_id, token: m.token }));
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

export class AdminConnConfig implements ConnectionConfig, CoreEntitySubmitter {
    id: number;
    name: string;
    enabled: boolean;
    auth: Static<typeof ConnectionAuth>;
    config: ConfigStateful;

    submittingEntities: boolean;
    entityInterval?: ReturnType<typeof setInterval>;

    /** When each Entity was last broadcast - throttles immediate submits on create & update */
    lastBroadcast: Map<string, number>;

    constructor(config: ConfigStateful) {
        this.config = config;
        this.id = 0;
        this.name = 'admin';
        this.enabled = config.server.connection;
        this.auth = {
            cert: config.server.auth.cert!,
            key: config.server.auth.key!,
        };

        this.submittingEntities = false;
        this.lastBroadcast = new Map();
    }

    uid(): string {
        return ConnectionControl.uid(this.auth.cert);
    }

    startEntities(tak: TAK, api: TAKAPI): void {
        this.stopEntities();

        this.entityInterval = setInterval(() => {
            this.submitEntities(tak, api).catch((err) => {
                console.error(`not ok - ${this.id} - ${this.name} - failed to submit Core Entities:`, err);
            });
        }, ENTITY_INTERVAL);

        this.entityInterval.unref();
    }

    stopEntities(): void {
        if (this.entityInterval) {
            clearInterval(this.entityInterval);
            this.entityInterval = undefined;
        }
    }

    async submitEntities(tak: TAK, api: TAKAPI, opts?: { entity?: string }): Promise<void> {
        if (this.submittingEntities || !tak.open) return;

        // An Entity broadcast within the interval waits for the next sweep
        if (opts?.entity && Date.now() - (this.lastBroadcast.get(opts.entity) ?? 0) < ENTITY_INTERVAL) return;

        this.submittingEntities = true;

        try {
            const groups = new Map<number, string>();
            for (const group of (await api.Group.list({ useCache: true })).data) {
                groups.set(group.bitpos, group.name);
            }

            const cots: CoT[] = [];

            for await (const entity of this.config.models.CoreEntity.broadcast_iter({ id: opts?.entity })) {
                const dest = entity.channels
                    .map(channel => groups.get(channel))
                    .filter((group): group is string => group !== undefined)
                    .map(group => ({ group }));

                // An Entity with no resolvable Channels would otherwise be
                // broadcast to every Channel the Admin cert can see
                if (!dest.length) continue;

                const links: Array<Record<string, string>> = [];
                const remarks: string[] = [];
                let start: string;
                let stale: number;

                // The `p` (parent) Link carries the Entity UUID so a CloudTAK
                // client can open the Event or Device a marker was generated from
                if (entity.kind === LayerMapping_Destination.COREDEVICE) {
                    links.push({
                        relation: 'p',
                        type: 'core-device',
                        device: entity.id,
                        url: `${this.config.API_URL}/device/${entity.id}`,
                        remarks: entity.name,
                    });

                    start = entity.updated;
                    stale = DEVICE_STALE;
                } else {
                    links.push({
                        relation: 'p',
                        type: 'core-event',
                        event: entity.id,
                        url: `${this.config.API_URL}/event/${entity.id}`,
                        remarks: entity.name,
                    });

                    remarks.push(`Location:\n${entity.location}`, `Priority:\n${entity.priority}`);

                    start = entity.started;
                    stale = eventStale(entity.ended);
                }

                // `r-u` (refinement url) links render in ATAK as tappable
                // external links
                for (const link of entity.links) {
                    if (!link.url) continue;

                    links.push({
                        relation: 'r-u',
                        ...(link.url.startsWith('tel:') ? {} : { mime: 'text/html' }),
                        url: link.url,
                        remarks: link.name,
                    });
                }

                if (entity.remarks) remarks.push(entity.remarks);

                try {
                    // node-cot converts a numeric 2525E SIDC type to a CoT
                    // Atom type, retaining the SIDC in a milsym entry
                    cots.push(await CoTParser.from_geojson({
                        id: entity.id,
                        type: 'Feature',
                        properties: {
                            ...entity.style,
                            type: entity.type,
                            // Machine generated - clients disallow editing the
                            // Entity as a plain CoT
                            how: 'm-g',
                            callsign: entity.name,
                            remarks: remarks.join('\n\n'),
                            start,
                            stale,
                            dest,
                            links,
                        },
                        geometry: entity.geometry,
                    }));
                } catch (err) {
                    console.error(`not ok - ${this.id} - ${this.name} - failed to convert Core ${entity.kind === LayerMapping_Destination.COREDEVICE ? 'Device' : 'Event'} ${entity.id} to CoT: ${err instanceof Error ? err.message : String(err)}`);
                }
            }

            if (cots.length) {
                tak.write(cots);
            }

            // A sweep rebuilds the map so Entities that stop broadcasting are dropped
            const now = Date.now();
            if (!opts?.entity) this.lastBroadcast.clear();
            for (const cot of cots) this.lastBroadcast.set(cot.uid(), now);
        } finally {
            this.submittingEntities = false;
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
