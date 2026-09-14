import type { Static } from '@sinclair/typebox';
import { Feature } from '@tak-ps/node-cot';

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
