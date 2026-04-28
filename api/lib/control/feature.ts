import type { Static } from '@sinclair/typebox';
import { Feature } from '@tak-ps/node-cot';

type FeatureProperties = Static<typeof Feature.Properties>;

export function enabledGeofence(properties?: Pick<FeatureProperties, 'geofence'>): boolean {
    return properties?.geofence?.tracking === true;
}