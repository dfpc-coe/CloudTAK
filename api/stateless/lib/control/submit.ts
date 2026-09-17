import type { Static } from '@sinclair/typebox';
import { sql } from 'drizzle-orm';
import Err from '@openaddresses/batch-error';
import pointOnFeature from '@turf/point-on-feature';
import type { Feature as GeoJSONFeature, Geometry } from 'geojson';
import Mapping from '../../../common/mapping.js';
import type { MappingFeature, MappedEvent, MappedDevice } from '../../../common/mapping.js';
import { LayerMapping_Destination } from '../../../common/enums.js';
import { ETLEventAction } from '../../../common/etl-events.js';
import type ConfigStateless from '../../config.js';

export type SubmitAction = 'create' | 'update';

/**
 * Persist CoreEvents & CoreDevices produced by the Layer Maps of a submission
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

    async event(connection: number, feature: MappingFeature, mapped: Static<typeof MappedEvent>): Promise<{ id: string; action: SubmitAction }> {
        const geometry = this.eventGeometry(feature);
        if (!geometry) throw new Err(400, null, 'CoreEvent requires a Feature geometry');

        const external_id = mapped.external_id ?? (feature.id ? String(feature.id) : '');

        const fields = {
            ...mapped,
            ...(mapped.ended === undefined ? {} : { active: !mapped.ended }),
            external_id,
            geometry,
            metadata: feature.properties?.metadata ?? {},
        };

        const existing = await this.existing(this.config.models.CoreEvent, connection, external_id);

        let id: string;
        let action: SubmitAction;

        if (existing) {
            await this.config.models.CoreEvent.commit(existing, {
                ...fields,
                updated: sql`Now()`,
            });

            id = existing;
            action = 'update';
        } else {
            const name = mapped.name ?? (feature.properties?.callsign || (feature.id ? String(feature.id) : undefined));
            const missing = Mapping.missing(LayerMapping_Destination.COREEVENT, { ...fields, name });
            if (missing.length) throw new Err(400, null, `CoreEvent Map did not produce: ${missing.join(', ')}`);

            const event = await this.config.models.CoreEvent.generate({
                ...fields,
                name: name as string,
                type: fields.type as string,
                username: null,
                connection,
            });

            id = event.id;
            action = 'create';
        }

        // Best effort - a failed immediate submit is recovered by the
        // Admin Connection's next scheduled submit cycle
        this.config.hub.coreEventSubmit(id).catch((err) => {
            console.error(`not ok - failed to immediately submit Core Event ${id}:`, err);
        });

        this.config.models.CoreEvent.augmented_from(id).then((event) => {
            return this.config.etlEvents.event(action === 'create' ? ETLEventAction.Create : ETLEventAction.Update, event);
        }).catch((err) => {
            console.error(`not ok - failed to deliver ${action} ETL Event for Core Event ${id}:`, err);
        });

        return { id, action };
    }

    async device(connection: number, feature: MappingFeature, mapped: Static<typeof MappedDevice>): Promise<{ id: string; action: SubmitAction }> {
        const external_id = mapped.external_id ?? (feature.id ? String(feature.id) : '');

        const fields = {
            ...mapped,
            external_id,
            metadata: feature.properties?.metadata ?? {},
        };

        const existing = await this.existing(this.config.models.CoreDevice, connection, external_id);

        if (existing) {
            await this.config.models.CoreDevice.commit(existing, {
                ...fields,
                updated: sql`Now()`,
            });

            return { id: existing, action: 'update' };
        }

        const name = mapped.name ?? (feature.properties?.callsign || (feature.id ? String(feature.id) : undefined));
        const missing = Mapping.missing(LayerMapping_Destination.COREDEVICE, { ...fields, name });
        if (missing.length) throw new Err(400, null, `CoreDevice Map did not produce: ${missing.join(', ')}`);

        const device = await this.config.models.CoreDevice.generate({
            ...fields,
            name: name as string,
            type: fields.type as string,
            username: null,
            connection,
        });

        return { id: device.id, action: 'create' };
    }

    /**
     * Point geometry of an Event - the Feature's own Point, or a point on the
     * surface of a LineString or Polygon
     */
    eventGeometry(feature: MappingFeature): { type: 'Point'; coordinates: [number, number] } | null {
        if (!feature.geometry) return null;

        if (feature.geometry.type === 'Point') {
            return { type: 'Point', coordinates: [feature.geometry.coordinates[0], feature.geometry.coordinates[1]] };
        }

        const point = pointOnFeature({
            type: 'Feature',
            properties: {},
            geometry: feature.geometry as Geometry,
        } as GeoJSONFeature);

        return { type: 'Point', coordinates: [point.geometry.coordinates[0], point.geometry.coordinates[1]] };
    }

    async existing(
        model: ConfigStateless['models']['CoreEvent'] | ConfigStateless['models']['CoreDevice'],
        connection: number,
        external_id: string,
    ): Promise<string | null> {
        if (!external_id) return null;

        const list = await model.list({
            limit: 1,
            where: sql`connection = ${connection} AND external_id = ${external_id}`,
        });

        return list.items.length ? list.items[0].id : null;
    }
}
