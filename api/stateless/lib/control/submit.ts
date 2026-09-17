import { sql, eq, and, getTableName } from 'drizzle-orm';
import Err from '@openaddresses/batch-error';
import pointOnFeature from '@turf/point-on-feature';
import type { Feature as GeoJSONFeature, Geometry } from 'geojson';
import type { MappingFeature, MappedEvent, MappedDevice } from '../../../common/mapping.js';
import { CoreEvent, CoreEventChannel, CoreDevice, CoreDeviceChannel } from '../../../common/schema.js';
import { ETLEventAction } from '../../../common/etl-events.js';
import { notifyCoreEvent } from '../core-event.js';
import type ConfigStateless from '../../config.js';

const HAS_EXTERNAL_ID = sql`external_id <> ''`;

// xmax is only set on a row version produced by the conflict UPDATE
const INSERTED = sql<boolean>`(xmax = 0)`;

/**
 * Persist CoreEvents & CoreDevices produced by the Layer Mappings of a submission
 *
 * Records are UPSERTed on the `external_id` of the Connection - the mapped
 * value, falling back to the Feature ID - records without one are always created
 */
export default class SubmitControl {
    config: ConfigStateless;

    constructor(config: ConfigStateless) {
        this.config = config;
    }

    async event(connection: number, feature: MappingFeature, mapped: MappedEvent, createOnly: Set<string> = new Set()): Promise<void> {
        const geometry = this.eventGeometry(feature);
        if (!geometry) throw new Err(400, null, 'CoreEvent requires a Feature geometry');

        const { channels, ...columns } = mapped;

        // active & ended are kept consistent the way PATCH /core/event keeps them - an explicit value always wins
        const closing = columns.ended === undefined && columns.active === false;
        if (columns.ended !== undefined && columns.active === undefined) columns.active = !columns.ended;
        if (columns.ended === undefined && columns.active === true) columns.ended = null;

        // A value derived from a create only field is itself create only
        createOnly = new Set(createOnly);
        if (createOnly.has('active') && mapped.ended === undefined) createOnly.add('ended');
        if (createOnly.has('ended') && mapped.active === undefined) createOnly.add('active');

        const record = this.#record(CoreEvent, connection, feature, { ...columns, geometry }, createOnly);

        const { id, inserted } = await this.config.pg.transaction(async (tx) => {
            const [row] = await tx.insert(CoreEvent)
                .values(closing ? { ...record.values, ended: sql`Now()` } : record.values)
                .onConflictDoUpdate({
                    target: [CoreEvent.connection, CoreEvent.external_id],
                    targetWhere: HAS_EXTERNAL_ID,
                    set: closing && !createOnly.has('ended') ? { ...record.set, ended: sql`COALESCE(${CoreEvent.ended}, Now())` } : record.set,
                })
                .returning({ id: CoreEvent.id, inserted: INSERTED });

            if (channels && (row.inserted || !createOnly.has('channels'))) {
                await tx.delete(CoreEventChannel).where(eq(CoreEventChannel.event, row.id));
                await tx.insert(CoreEventChannel).values(channels.map(channel => ({ event: row.id, channel: BigInt(channel) })));
            }

            return row;
        });

        const action = inserted ? ETLEventAction.Create : ETLEventAction.Update;

        this.config.models.CoreEvent.augmented_from(id).then((event) => {
            notifyCoreEvent(this.config, action, event);
        }).catch((err) => {
            console.error(`not ok - failed to notify ${action} of Core Event ${id}:`, err);
        });
    }

    async device(connection: number, feature: MappingFeature, mapped: MappedDevice, createOnly: Set<string> = new Set()): Promise<void> {
        const { channels, event_external_id, ...columns } = mapped;

        createOnly = new Set(createOnly);
        if (createOnly.has('event_external_id')) createOnly.add('event');

        const record = this.#record(CoreDevice, connection, feature, {
            ...columns,
            ...(event_external_id === undefined ? {} : { event: await this.#eventId(connection, event_external_id) }),
        }, createOnly);

        await this.config.pg.transaction(async (tx) => {
            const [row] = await tx.insert(CoreDevice)
                .values(record.values)
                .onConflictDoUpdate({ target: [CoreDevice.connection, CoreDevice.external_id], targetWhere: HAS_EXTERNAL_ID, set: record.set })
                .returning({ id: CoreDevice.id, inserted: INSERTED });

            if (channels && (row.inserted || !createOnly.has('channels'))) {
                await tx.delete(CoreDeviceChannel).where(eq(CoreDeviceChannel.device, row.id));
                await tx.insert(CoreDeviceChannel).values(channels.map(channel => ({ device: row.id, channel: BigInt(channel) })));
            }
        });
    }

    /** Core Event of the Connection with the given external_id - null unassigns the Device */
    async #eventId(connection: number, external_id: string): Promise<string | null> {
        if (!external_id.trim()) return null;

        const [event] = await this.config.pg.select({ id: CoreEvent.id })
            .from(CoreEvent)
            .where(and(eq(CoreEvent.connection, connection), eq(CoreEvent.external_id, external_id.trim())))
            .limit(1);

        return event ? event.id : null;
    }

    /**
     * Values to insert & the subset to overwrite when the external_id already
     * exists on the Connection - create only fields are left out of the overwrite
     * and object columns are merged so their create only properties survive
     */
    #record<T extends Omit<MappedEvent | MappedDevice, 'channels' | 'event_external_id'>>(
        table: typeof CoreEvent | typeof CoreDevice,
        connection: number,
        feature: MappingFeature,
        mapped: T,
        createOnly: Set<string>,
    ) {
        const featureId = feature.id ? String(feature.id) : undefined;

        const name = mapped.name ?? (feature.properties?.callsign || featureId);
        const type = mapped.type;

        const label = table === CoreEvent ? 'CoreEvent' : 'CoreDevice';
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

            set[key] = sql`${sql.identifier(getTableName(table))}.${sql.identifier(key)} || ${JSON.stringify(Object.fromEntries(properties))}::text::jsonb`;
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
