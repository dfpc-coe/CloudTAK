import type { Component } from 'vue';
import type { paths } from '@cloudtak/api-types';
import { server } from '../../../../std.ts';
import TypeSelectorArcGIS from './TypeSelectorArcGIS.vue';
import TypeSelectorComposite from './TypeSelectorComposite.vue';
import TypeSelectorHosted from './TypeSelectorHosted.vue';
import TypeSelectorSlope from './TypeSelectorSlope.vue';
import TypeSelectorZxy from './TypeSelectorZxy.vue';
import TypeSelectorZxy_Tilejson from './TypeSelectorZxy_Tilejson.vue';
import TypeSelectorZxy_Upload from './TypeSelectorZxy_Upload.vue';
import { BasemapTypeConfig, inferBasemapType, normalizeEditing } from './types.ts';
import type {
    BasemapImport,
    BasemapImportRequest,
    BasemapSourceType,
    EditingBasemap,
    VectorLayerDescriptor,
} from './types.ts';

export type BasemapProtocol = BasemapCreateBody['protocol'];
export type BasemapScope = BasemapCreateBody['scope'];
export type BasemapCreateBody = paths['/api/basemap']['post']['requestBody']['content']['application/json'];
export type BasemapUpdateBody = paths['/api/basemap/{:basemapid}']['patch']['requestBody']['content']['application/json'];

export type BasemapErrors = Record<'name' | 'url', string>;

/**
 * Payload a mode emits once it has produced a tile source. `mode` is the mode
 * the editor should continue in: import-only modes (tilejson, upload, hosted)
 * hand off to the mode inferred from the imported tile URL.
 */
export interface BasemapImported {
    editing: EditingBasemap;
    vectorLayers: VectorLayerDescriptor[];
    mode: BasemapSourceType;
}

export interface BasemapMode {
    component: Component;
    /** Protocol persisted for basemaps created in this mode, null for import-only modes */
    protocol: BasemapProtocol | null;
    /** Whether the shared form and save footer should be shown */
    ready: (editing: EditingBasemap, basemapId?: number) => boolean;
}

export function isImported(editing: EditingBasemap, basemapId?: number): boolean {
    return !!basemapId || !!editing.url;
}

export const BasemapModes: Record<BasemapSourceType, BasemapMode> = {
    zxy: { component: TypeSelectorZxy, protocol: 'zxy', ready: () => true },
    imageserver: { component: TypeSelectorArcGIS, protocol: 'imageserver', ready: isImported },
    mapserver: { component: TypeSelectorArcGIS, protocol: 'mapserver', ready: isImported },
    featureserver: { component: TypeSelectorArcGIS, protocol: 'featureserver', ready: isImported },
    tilejson: { component: TypeSelectorZxy_Tilejson, protocol: null, ready: () => false },
    upload: { component: TypeSelectorZxy_Upload, protocol: null, ready: () => false },
    hosted: { component: TypeSelectorHosted, protocol: null, ready: () => false },
    slope: { component: TypeSelectorSlope, protocol: 'zxy', ready: isImported },
    composite: { component: TypeSelectorComposite, protocol: 'zxy', ready: isImported },
};

export function blankEditing(overrides: Partial<EditingBasemap> = {}): EditingBasemap {
    return {
        name: '',
        url: '',
        type: 'raster',
        minzoom: 0,
        maxzoom: 16,
        tilesize: 256,
        attribution: '',
        sharing_enabled: true,
        format: 'png',
        bounds: [-180, -90, 180, 90],
        center: [0, 0],
        collection: '',
        title: '{{callsign}}',
        overlay: false,
        hidden: false,
        frequency: null,
        snapping_enabled: false,
        snapping_layer: '',
        styles: [],
        tilejson: '',
        encoding: null,
        args: {},
        ...overrides,
    };
}

/** Editing state for a freshly selected mode, keeping fields the user already filled in */
export function beginMode(mode: BasemapSourceType, editing: EditingBasemap): EditingBasemap {
    return {
        ...editing,
        ...BasemapTypeConfig[mode].defaults,
        url: '',
    };
}

/**
 * Mode an existing or freshly imported basemap should be edited in. The tile
 * URL shape identifies modes that share a protocol (slope, hosted tilesets are
 * zxy rows); the stored protocol covers URLs that match no pattern.
 */
export function resolveMode(url: string, protocol?: string | null): BasemapSourceType {
    const inferred = inferBasemapType(url);
    if (inferred) return inferred;

    if (protocol && protocol in BasemapModes && BasemapModes[protocol as BasemapSourceType].protocol) {
        return protocol as BasemapSourceType;
    }

    return 'zxy';
}

/** PUT /api/basemap: a bare string is a TileJSON/WMTS URL, an object is an ArcGIS service import */
export async function importBasemap(request: string | BasemapImportRequest): Promise<BasemapImport> {
    const res = await server.PUT('/api/basemap', typeof request === 'string'
        ? {
            headers: { 'Content-Type': 'text/plain' },
            body: request,
        }
        : {
            headers: { 'Content-Type': 'application/json' },
            body: request,
        });

    if (res.error) throw new Error(res.error.message);

    return res.data as BasemapImport;
}

export function fromImport(data: BasemapImport, mode?: BasemapSourceType): BasemapImported {
    const editing = normalizeEditing(data);

    return {
        editing,
        vectorLayers: Array.isArray(data.vector_layers) ? data.vector_layers : [],
        mode: mode ?? resolveMode(editing.url),
    };
}

export function validateEditing(editing: EditingBasemap): BasemapErrors {
    return {
        name: editing.name ? '' : 'Cannot be empty',
        url: editing.url ? '' : 'Cannot be empty',
    };
}

export function toBasemapBody(
    editing: EditingBasemap,
    protocol: BasemapProtocol,
    scope: BasemapScope,
): BasemapCreateBody {
    return {
        scope,
        protocol,
        name: editing.name,
        url: editing.url,
        type: editing.type,
        format: editing.format,
        minzoom: editing.minzoom,
        maxzoom: editing.maxzoom,
        tilesize: editing.tilesize,
        overlay: editing.overlay,
        hidden: editing.hidden,
        sharing_enabled: editing.sharing_enabled,
        snapping_enabled: editing.snapping_enabled,
        frequency: editing.frequency || null,
        collection: editing.collection.trim().length ? editing.collection : null,
        attribution: editing.attribution.trim().length ? editing.attribution : null,
        styles: editing.styles,
        args: editing.args,
        ...(editing.snapping_enabled && editing.snapping_layer.trim().length ? { snapping_layer: editing.snapping_layer } : {}),
        ...(editing.encoding ? { encoding: editing.encoding } : {}),
        ...(editing.bounds.length ? { bounds: editing.bounds } : {}),
        ...(editing.center.length ? { center: editing.center } : {}),
        ...(editing.type === 'vector' && editing.title.trim().length ? { title: editing.title } : {}),
        ...(editing.tilejson.trim().length ? { tilejson: editing.tilejson } : {}),
    };
}
