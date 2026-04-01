import type { Basemap, BasemapList } from '../../../../types.ts';
import type { paths } from '@cloudtak/api-types';
import {
    IconDatabase,
    IconFileImport,
    IconFileUpload,
    IconGridDots,
    IconMap,
    IconPhoto,
    IconVector,
} from '@tabler/icons-vue';

export interface BasemapImportRequest {
    type: BasemapSourceType;
    url: string;
    auth?: {
        username?: string;
        password?: string;
        referer?: string;
        expiration?: number;
    };
}

export interface EditingBasemap {
    name: string;
    url: string;
    type: 'raster' | 'raster-dem' | 'vector';
    minzoom: number;
    maxzoom: number;
    tilesize: number;
    attribution: string;
    sharing_enabled: boolean;
    format: 'png' | 'jpeg' | 'mvt';
    bounds: number[];
    center: number[];
    collection: string;
    title: string;
    overlay: boolean;
    hidden: boolean;
    frequency: number | null;
    snapping_enabled: boolean;
    snapping_layer: string;
    styles: unknown[];
    tilejson: string;
}

export interface VectorLayerFieldMap {
    [key: string]: unknown;
}

export interface VectorLayerDescriptor {
    id?: string;
    fields?: VectorLayerFieldMap;
}

export type BasemapImport = paths['/api/basemap']['put']['responses']['200']['content']['application/json'] & {
    vector_layers?: VectorLayerDescriptor[];
};

export type BasemapSourceType = 'zxy' | 'imageserver' | 'mapserver' | 'featureserver' | 'tilejson' | 'upload' | 'hosted';

export const BasemapTypeConfig: Record<BasemapSourceType, {
    label: string;
    description: string;
    icon: object;
    urlLabel: string;
    urlDescription: string;
    urlPlaceholder: string;
    urlTokens: Array<{ value: string; tooltip: string }>;
    defaults: Pick<EditingBasemap, 'type' | 'format' | 'minzoom' | 'maxzoom' | 'tilesize'>;
}> = {
    zxy: {
        label: 'ZXY',
        description: 'Configure a standard XYZ tile template.',
        icon: IconGridDots,
        urlLabel: 'Tile URL Template',
        urlDescription: 'Provide a standard XYZ template using zoom, x, and y variables.',
        urlPlaceholder: 'https://example.com/tiles/{$z}/{$x}/{$y}.png',
        urlTokens: [
            { value: '{$z}', tooltip: 'Insert Zoom Variable' },
            { value: '{$x}', tooltip: 'Insert X Variable' },
            { value: '{$y}', tooltip: 'Insert Y Variable' },
            { value: '{$q}', tooltip: 'Insert Quadkey Variable' },
        ],
        defaults: {
            type: 'raster',
            format: 'png',
            minzoom: 0,
            maxzoom: 16,
            tilesize: 256,
        },
    },
    imageserver: {
        label: 'ImageServer',
        description: 'Use an ArcGIS ImageServer service endpoint.',
        icon: IconPhoto,
        urlLabel: 'Service URL',
        urlDescription: 'Provide the ArcGIS ImageServer endpoint for this basemap.',
        urlPlaceholder: 'https://example.com/arcgis/rest/services/WorldImagery/ImageServer',
        urlTokens: [],
        defaults: {
            type: 'raster',
            format: 'png',
            minzoom: 0,
            maxzoom: 20,
            tilesize: 256,
        },
    },
    mapserver: {
        label: 'MapServer',
        description: 'Use an ArcGIS MapServer layer endpoint.',
        icon: IconMap,
        urlLabel: 'Service URL',
        urlDescription: 'Provide the ArcGIS MapServer layer URL, including the layer id.',
        urlPlaceholder: 'https://example.com/arcgis/rest/services/WorldTopo/MapServer/1',
        urlTokens: [],
        defaults: {
            type: 'vector',
            format: 'mvt',
            minzoom: 0,
            maxzoom: 20,
            tilesize: 256,
        },
    },
    featureserver: {
        label: 'FeatureServer',
        description: 'Use an ArcGIS FeatureServer layer endpoint.',
        icon: IconVector,
        urlLabel: 'Service URL',
        urlDescription: 'Provide the ArcGIS FeatureServer layer URL, including the layer id.',
        urlPlaceholder: 'https://example.com/arcgis/rest/services/Parcels/FeatureServer/1',
        urlTokens: [],
        defaults: {
            type: 'vector',
            format: 'mvt',
            minzoom: 0,
            maxzoom: 20,
            tilesize: 256,
        },
    },
    tilejson: {
        label: 'TileJSON Import',
        description: 'Fetch defaults from a TileJSON URL.',
        icon: IconFileImport,
        urlLabel: 'TileJSON URL',
        urlDescription: 'Provide a TileJSON document URL to prefill the basemap form.',
        urlPlaceholder: 'https://example.com/tilejson.json',
        urlTokens: [],
        defaults: {
            type: 'raster',
            format: 'png',
            minzoom: 0,
            maxzoom: 16,
            tilesize: 256,
        },
    },
    upload: {
        label: 'TAK XML Upload',
        description: 'Import basemap settings from an existing TAK XML file.',
        icon: IconFileUpload,
        urlLabel: 'Tile Url',
        urlDescription: 'The tile endpoint or service URL for this basemap',
        urlPlaceholder: 'https://example.com/tiles/{$z}/{$x}/{$y}.png',
        urlTokens: [],
        defaults: {
            type: 'raster',
            format: 'png',
            minzoom: 0,
            maxzoom: 16,
            tilesize: 256,
        },
    },
    hosted: {
        label: 'Hosted Tileset',
        description: 'Select from hosted PMTiles tilesets on this server.',
        icon: IconDatabase,
        urlLabel: 'TileJSON URL',
        urlDescription: 'The hosted tileset TileJSON endpoint.',
        urlPlaceholder: '',
        urlTokens: [],
        defaults: {
            type: 'raster',
            format: 'png',
            minzoom: 0,
            maxzoom: 16,
            tilesize: 256,
        },
    },
};

export function inferBasemapType(url?: string | null): BasemapSourceType | null {
    if (!url) return null;
    if (url.includes('{$q}')) return 'zxy';
    if (url.match(/\/FeatureServer\/\d+$/)) return 'featureserver';
    if (url.match(/\/MapServer\/\d+$/)) return 'mapserver';
    if (url.endsWith('/ImageServer')) return 'imageserver';
    if (url.includes('{$z}') && url.includes('{$x}') && url.includes('{$y}')) return 'zxy';
    return null;
}

export function normalizeEditing(data: Basemap | BasemapImport | BasemapListItem): EditingBasemap {
    return {
        name: data.name ?? '',
        url: data.url ?? '',
        type: data.type ?? 'raster',
        minzoom: data.minzoom ?? 0,
        maxzoom: data.maxzoom ?? 16,
        tilesize: ('tilesize' in data ? data.tilesize : undefined) ?? 256,
        attribution: ('attribution' in data ? data.attribution : undefined) ?? '',
        sharing_enabled: ('sharing_enabled' in data ? data.sharing_enabled : undefined) ?? true,
        format: data.format ?? 'png',
        bounds: ('bounds' in data && Array.isArray(data.bounds) ? data.bounds : null) ?? [-180, -90, 180, 90],
        center: ('center' in data && Array.isArray(data.center) ? data.center : null) ?? [0, 0],
        collection: ('collection' in data ? data.collection : undefined) ?? '',
        title: ('title' in data ? data.title : undefined) ?? '{{callsign}}',
        overlay: ('overlay' in data ? data.overlay : undefined) ?? false,
        hidden: ('hidden' in data ? data.hidden : undefined) ?? false,
        frequency: ('frequency' in data ? data.frequency : undefined) ?? null,
        snapping_enabled: ('snapping_enabled' in data ? data.snapping_enabled : undefined) ?? false,
        snapping_layer: ('snapping_layer' in data ? data.snapping_layer : undefined) ?? '',
        styles: ('styles' in data && Array.isArray(data.styles) ? data.styles : null) ?? [],
        tilejson: String(('tilejson' in data ? data.tilejson : undefined) ?? ''),
    };
}

export type BasemapListItem = Partial<BasemapList['items'][0]>;