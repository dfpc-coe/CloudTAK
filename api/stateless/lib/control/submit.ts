import { sql } from 'drizzle-orm';
import Err from '@openaddresses/batch-error';
import pointOnFeature from '@turf/point-on-feature';
import type { Feature as GeoJSONFeature, Geometry } from 'geojson';
import type { MappingFeature, MappedEvent, MappedDevice } from '../../../common/mapping.js';
import { ETLEventAction } from '../../../common/etl-events.js';
import { notifyCoreEvent } from '../core-event.js';
import type ConfigStateless from '../../config.js';

type Models = ConfigStateless['models'];

/**
 * Persist CoreEvents & CoreDevices produced by the Layer Mappings of a submission
 *
 * Records are matched to an existing row of the same Connection by
 * `external_id` - the mapped value, falling back to the Feature ID - and
 * updated in place, otherwise a new row is created
 */
export default class SubmitControl {
    config: ConfigStateless;

    constructor(config: ConfigStateless) {
        this.config = config;
    }

    async event(connection: number, feature: MappingFeature, mapped: MappedEvent): Promise<void> {
        const geometry = this.eventGeometry(feature);
        if (!geometry) throw new Err(400, null, 'CoreEvent requires a Feature geometry');

        const { id, action } = await this.#upsert(this.config.models.CoreEvent, 'CoreEvent', connection, feature, {
            ...mapped,
            ...(mapped.ended === undefined ? {} : { active: !mapped.ended }),
            geometry,
        });

        this.config.models.CoreEvent.augmented_from(id).then((event) => {
            notifyCoreEvent(this.config, action, event);
        }).catch((err) => {
            console.error(`not ok - failed to notify ${action} of Core Event ${id}:`, err);
        });
    }

    async device(connection: number, feature: MappingFeature, mapped: MappedDevice): Promise<void> {
        await this.#upsert(this.config.models.CoreDevice, 'CoreDevice', connection, feature, mapped);
    }

    async #upsert(
        model: Models['CoreEvent'] | Models['CoreDevice'],
        label: string,
        connection: number,
        feature: MappingFeature,
        mapped: (MappedEvent | MappedDevice) & Record<string, unknown>,
    ): Promise<{ id: string; action: ETLEventAction }> {
        const featureId = feature.id ? String(feature.id) : undefined;

        const fields = {
            ...mapped,
            external_id: mapped.external_id ?? featureId ?? '',
            metadata: feature.properties?.metadata ?? {},
        };

        let existing: { id: string } | undefined;
        if (fields.external_id) {
            existing = (await model.list({
                limit: 1,
                where: sql`connection = ${connection} AND external_id = ${fields.external_id}`,
            })).items[0];
        }

        if (existing) {
            await model.commit(existing.id, { ...fields, updated: sql`Now()` });

            return { id: existing.id, action: ETLEventAction.Update };
        }

        const name = mapped.name ?? (feature.properties?.callsign || featureId);
        const missing = [!name && 'name', !mapped.type && 'type'].filter(Boolean);
        if (missing.length) throw new Err(400, null, `${label} Map did not produce: ${missing.join(', ')}`);

        // @ts-expect-error generate() is not callable across the model union
        const created = await model.generate({
            ...fields,
            name,
            type: mapped.type,
            username: null,
            connection,
        });

        return { id: created.id, action: ETLEventAction.Create };
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
