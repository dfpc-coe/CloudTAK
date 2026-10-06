import { sql, eq, getTableName } from 'drizzle-orm';
import type { PgInsertValue, PgUpdateSetSource } from 'drizzle-orm/pg-core';
import Err from '@openaddresses/batch-error';
import pointOnFeature from '@turf/point-on-feature';
import type { Feature as GeoJSONFeature, Geometry } from 'geojson';
import type { MappingFeature, MappedEvent, MappedDevice } from '../../../common/mapping.js';
import { CoreEntity, CoreEntityEvent, CoreEntityDevice, CoreEntityChannel } from '../../../common/schema.js';
import { LayerMapping_Destination } from '../../../common/enums.js';
import { splitEvent, setChannels } from '../../../common/models/CoreEntity.js';
import { splitDevice } from '../../../common/models/CoreDevice.js';
import { ETLEventAction } from '../../../common/etl-events.js';
import { notifyCoreEntity } from '../core-entity.js';
import type ConfigStateless from '../../config.js';

export interface SubmitOptions {
    /** Fields only applied when the record is created */
    createOnly?: Set<string>;
    /** Channels of the Connection - shared with records whose Mapping defines no channels & that are not shared yet */
    inherit?: () => Promise<number[]>;
}

const HAS_EXTERNAL_ID = sql`external_id <> ''`;

// Ending an Event never moves an end time that has already passed
const END_NOW = sql`LEAST(COALESCE(${CoreEntityEvent.ended}, Now()), Now())`;

// xmax is only set on a row version produced by the conflict UPDATE
const INSERTED = sql<boolean>`(xmax = 0)`;

type Tx = Parameters<Parameters<ConfigStateless['pg']['transaction']>[0]>[0];
type Side = typeof CoreEntityEvent | typeof CoreEntityDevice;

/**
 * Persist CoreEntities & CoreDevices produced by the Layer Mappings of a submission
 *
 * Records are UPSERTed on the `external_id` of the Connection - the mapped
 * value, falling back to the Feature ID - records without one are always created
 */
export default class SubmitControl {
    config: ConfigStateless;

    constructor(config: ConfigStateless) {
        this.config = config;
    }

    async event(connection: number, feature: MappingFeature, mapped: MappedEvent, opts: SubmitOptions = {}): Promise<void> {
        const geometry = this.eventGeometry(feature);
        if (!geometry) throw new Err(400, null, 'CoreEvent requires a Feature geometry');

        const { channels, active, ...columns } = mapped;

        // active is a convenience over ended the way it is on PATCH /core/event - an explicit ended always wins
        const closing = columns.ended === undefined && active === false;
        if (columns.ended === undefined && active === true) columns.ended = null;

        // A value derived from a create only field is itself create only
        const createOnly = new Set(opts.createOnly);
        if (createOnly.has('active') && mapped.ended === undefined) createOnly.add('ended');

        const record = this.#record('CoreEvent', connection, feature, { ...columns, geometry }, createOnly);
        const inherited = channels ? [] : await opts.inherit?.() ?? [];

        const values = splitEvent(closing ? { ...record.values, ended: sql`Now()` } : record.values);
        const set = splitEvent(record.set);
        if (closing && !createOnly.has('ended')) set.event.ended = END_NOW;

        const { id, inserted } = await this.config.pg.transaction(async (tx) => {
            const row = await this.#upsert(tx, LayerMapping_Destination.COREENTITY, values.entity, set.entity);
            await this.#side(tx, CoreEntityEvent, row.id, values.event, set.event);
            await this.#channels(tx, row, channels, inherited, createOnly);
            return row;
        });

        const action = inserted ? ETLEventAction.Create : ETLEventAction.Update;

        this.config.models.CoreEntity.augmented_from(id).then((event) => {
            notifyCoreEntity(this.config, action, event);
        }).catch((err) => {
            console.error(`not ok - failed to notify ${action} of Core Event ${id}:`, err);
        });
    }

    async device(connection: number, feature: MappingFeature, mapped: MappedDevice, opts: SubmitOptions = {}): Promise<void> {
        const { channels, ...columns } = mapped;

        const createOnly = new Set(opts.createOnly);

        // A submission without a geometry keeps the last known location
        const geometry = this.eventGeometry(feature);
        const record = this.#record('CoreDevice', connection, feature, { ...columns, ...(geometry ? { geometry } : {}) }, createOnly);
        const inherited = channels ? [] : await opts.inherit?.() ?? [];

        const values = splitDevice(record.values);
        const set = splitDevice(record.set);

        await this.config.pg.transaction(async (tx) => {
            const row = await this.#upsert(tx, LayerMapping_Destination.COREDEVICE, values.entity, set.entity);
            await this.#side(tx, CoreEntityDevice, row.id, values.device, set.device);
            await this.#channels(tx, row, channels, inherited, createOnly);
        });
    }

    /** UPSERT the core_entity half of a record on the external_id of the Connection & kind */
    async #upsert(tx: Tx, kind: LayerMapping_Destination, values: Record<string, unknown>, set: Record<string, unknown>): Promise<{ id: string; inserted: boolean }> {
        const [row] = await tx.insert(CoreEntity)
            .values({ ...values, kind } as PgInsertValue<typeof CoreEntity>)
            .onConflictDoUpdate({
                target: [CoreEntity.connection, CoreEntity.kind, CoreEntity.external_id],
                targetWhere: HAS_EXTERNAL_ID,
                set: set as PgUpdateSetSource<typeof CoreEntity>,
            })
            .returning({ id: CoreEntity.id, inserted: INSERTED });

        return row;
    }

    /** UPSERT the side table half of a record on the shared primary key */
    async #side<T extends Side>(tx: Tx, table: T, id: string, values: Record<string, unknown>, set: Record<string, unknown>): Promise<void> {
        const insert = tx.insert(table).values({ ...values, id } as PgInsertValue<T>);

        if (Object.keys(set).length) {
            await insert.onConflictDoUpdate({ target: table.id, set: set as PgUpdateSetSource<T> });
        } else {
            await insert.onConflictDoNothing({ target: table.id });
        }
    }

    /** Mapped Channels replace the record's, inherited Channels only fill in a record that has none */
    async #channels(tx: Tx, row: { id: string; inserted: boolean }, channels: number[] | undefined, inherited: number[], createOnly: Set<string>): Promise<void> {
        if (channels && (row.inserted || !createOnly.has('channels'))) {
            await setChannels(tx, row.id, channels);
        } else if (inherited.length && (row.inserted || !(await tx.$count(CoreEntityChannel, eq(CoreEntityChannel.entity, row.id))))) {
            await tx.insert(CoreEntityChannel).values(inherited.map(channel => ({ entity: row.id, channel: BigInt(channel) })));
        }
    }

    /**
     * Values to insert & the subset to overwrite when the external_id already
     * exists on the Connection - create only fields are left out of the overwrite
     * and object columns are merged so their create only properties survive
     */
    #record<T extends Omit<MappedEvent | MappedDevice, 'channels'>>(
        label: 'CoreEvent' | 'CoreDevice',
        connection: number,
        feature: MappingFeature,
        mapped: T,
        createOnly: Set<string>,
    ) {
        const featureId = feature.id ? String(feature.id) : undefined;

        const name = mapped.name ?? (feature.properties?.callsign || featureId);
        const type = mapped.type;

        const missing = [!name && 'name', !type && 'type'].filter(Boolean);
        if (!name || !type) throw new Err(400, null, `${label} Map did not produce: ${missing.join(', ')}`);

        const set: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(mapped)) {
            if (createOnly.has(key)) continue;

            if (key === 'geometry' || value === null || typeof value !== 'object' || Array.isArray(value)) {
                set[key] = value;
                continue;
            }

            const properties = Object.entries(value).filter(([property]) => !createOnly.has(`${key}.${property}`));
            if (!properties.length) continue;

            set[key] = sql`${sql.identifier(getTableName(CoreEntity))}.${sql.identifier(key)} || ${JSON.stringify(Object.fromEntries(properties))}::text::jsonb`;
        }

        const identity = {
            external_id: mapped.external_id ?? featureId ?? '',
            metadata: feature.properties?.metadata ?? {},
        };

        return {
            values: { ...mapped, ...identity, name, type, username: null, connection },
            set: { ...set, ...identity, updated: sql`Now()` } as unknown as Partial<T>,
        };
    }

    /**
     * Point geometry of an Event - the Feature's own Point, or a point on the
     * surface of a LineString or Polygon
     */
    eventGeometry(feature: MappingFeature): { type: 'Point'; coordinates: [number, number] } | null {
        if (!feature.geometry) return null;

        const { coordinates } = feature.geometry.type === 'Point'
            ? feature.geometry
            : pointOnFeature({
                type: 'Feature',
                properties: {},
                geometry: feature.geometry as Geometry,
            } as GeoJSONFeature).geometry;

        return { type: 'Point', coordinates: [coordinates[0], coordinates[1]] };
    }
}
