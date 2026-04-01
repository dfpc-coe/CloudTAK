import { v4 as randomUUID } from 'uuid';
import pointOnFeature from '@turf/point-on-feature';
import type { Feature } from 'geojson';
import type { MapGeoJSONFeature } from 'maplibre-gl';
import { server } from '../../../std.ts';
import type { useMapStore } from '../../../stores/map.ts';
import type Overlay from '../../../base/overlay.ts';

type FeatureLike = Feature | MapGeoJSONFeature;
type MapStore = ReturnType<typeof useMapStore>;

export function getFeatureOverlay(mapStore: MapStore, feature?: FeatureLike): Overlay | null {
    if (!feature) return null;

    // @ts-expect-error MapLibre vector features expose source at runtime
    const sourceId = Number(feature.source);
    if (!sourceId || Number.isNaN(sourceId)) return null;

    return mapStore.getOverlayById(sourceId);
}

export function canCutOverlayFeature(mapStore: MapStore, feature?: FeatureLike): boolean {
    const overlay = getFeatureOverlay(mapStore, feature);

    return Boolean(
        overlay
        && feature
        && ['basemap', 'overlay'].includes(overlay.mode)
        && overlay.actions.feature.includes('fetch')
    );
}

export async function cutOverlayFeature(mapStore: MapStore, feature?: FeatureLike): Promise<void> {
    const overlay = getFeatureOverlay(mapStore, feature);

    if (!overlay || !feature) throw new Error('Could not determine Overlay');

    const { data: rawFeature, error } = await server.GET('/api/basemap/{:basemapid}/feature/{:featureid}', {
        params: {
            path: {
                ':basemapid': Number(overlay.mode_id),
                ':featureid': String(feature.id)
            }
        }
    });

    if (error || !rawFeature) throw new Error('Failed to load feature');

    if (
        rawFeature.geometry.type !== 'Point'
        && rawFeature.geometry.type !== 'LineString'
        && rawFeature.geometry.type !== 'Polygon'
    ) {
        throw new Error('Geometry type is not currently supported');
    }

    const id = randomUUID();
    const now = new Date().toISOString();

    mapStore.toImport.push({
        id,
        type: 'Feature',
        path: '/',
        properties: {
            id,
            type: 'u-d-p',
            how: 'h-g-i-g-o',
            color: '#00FF00',
            archived: true,
            time: now,
            start: now,
            stale: now,
            center: pointOnFeature(rawFeature).geometry.coordinates,
            callsign: String(rawFeature.properties?.title || 'New Feature')
        },
        geometry: rawFeature.geometry
    });
}