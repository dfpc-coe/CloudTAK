import type { Static } from '@sinclair/typebox';
import { GenerateUpsert } from '@openaddresses/batch-generic';
import { CoTParser, Feature } from '@tak-ps/node-cot';
import type CoT from '@tak-ps/node-cot';
import { ConnectionFeature } from '../../../common/schema.js';
import type ConfigStateless from '../../config.js';

type FeatureProperties = Static<typeof Feature.Properties>;

export function enabledGeofence(properties?: Pick<FeatureProperties, 'geofence'>): boolean {
    return properties?.geofence?.tracking === true;
}

/**
 * User pucks (TAK client self-position markers) carry a team/role group and
 * client version block and use the ANDROID- UID convention. They must never
 * be persisted to a user's feature database.
 */
export function isUserPuck(
    id: string,
    properties?: Pick<FeatureProperties, 'group' | 'takv'>,
): boolean {
    if (id.startsWith('ANDROID-')) return true;
    if (properties?.group) return true;
    if (properties?.takv && Object.keys(properties.takv).length) return true;

    return false;
}

const ARCHIVE_BATCH = 10000;

/**
 * Save CoTs delivered by a Connection to the ConnectionFeature table
 *
 * Failures are logged rather than thrown as the priority is TAK Server delivery
 */
export async function archiveCots(config: ConfigStateless, cots: CoT[], connection: number, layer: number | null): Promise<void> {
    try {
        const values = [];
        for (const cot of cots) {
            values.push({
                path: '/',
                connection,
                layer,
                ...(await CoTParser.to_geojson(cot)),
            });
        }

        for (let i = 0; i < values.length; i += ARCHIVE_BATCH) {
            await config.models.ConnectionFeature.generate(values.slice(i, i + ARCHIVE_BATCH), {
                upsert: GenerateUpsert.UPDATE,
                upsertTarget: [ConnectionFeature.connection, ConnectionFeature.id],
            });
        }
    } catch (err) {
        console.error(err);
    }
}
