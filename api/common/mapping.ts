import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import jsonata from 'jsonata';
import Err from '@openaddresses/batch-error';
import type { Feature } from '@tak-ps/node-cot';
import handlebars from './handlebars.js';
import { LayerMapping_Destination, CoreEvent_Priority } from './enums.js';
import type { LayerMap } from './layer-mapping.js';

/** A submitted Feature - the geometry is optional as CoreEvent & CoreDevice Maps do not require one */
export type MappingFeature = Omit<Static<typeof Feature.InputFeature>, 'geometry'> & {
    geometry?: Static<typeof Feature.InputFeature>['geometry'] | null;
};

export enum MapFieldKind {
    /** Handlebars template rendered against the Feature metadata */
    TEMPLATE = 'template',
    /** String copied as-is - colours, icons, stroke styles */
    LITERAL = 'literal',
    /** Number, or a template rendering to a number */
    NUMBER = 'number',
    BOOLEAN = 'boolean',
    /** String restricted to a list of options */
    ENUM = 'enum',
    /** Seconds until stale as a number, or a template rendering to seconds or a timestamp */
    SECONDS = 'seconds',
    /** Zoom level 0-24 as a number, or a template rendering to one */
    ZOOM = 'zoom',
    /** Template rendering to a date-time - an empty result clears the value */
    TIMESTAMP = 'timestamp',
    /** Array of { url, remarks } templates appended as CoT links */
    LINKS = 'links',
    /** { archive, dest } TAK Server routing */
    MARTI = 'marti',
}

export interface MapField {
    /** Dot path of the value in the Map object */
    key: string;
    kind: MapFieldKind;
    /** Dot path the value is written to on the output object */
    target: string;
    /** Only applied to Features of this geometry type */
    geometry?: 'Point' | 'LineString' | 'Polygon';
    options?: string[];
    /** Must be present when a new record is created from the Map */
    required?: boolean;
}

export const MapLink = Type.Object({
    remarks: Type.String(),
    url: Type.String(),
});

export const MapMartiDest = Type.Object({
    group: Type.Optional(Type.String()),
    mission: Type.Optional(Type.String()),
    uid: Type.Optional(Type.String()),
    callsign: Type.Optional(Type.String()),
});

export const MapMarti = Type.Object({
    archive: Type.Optional(Type.Boolean()),
    dest: Type.Optional(Type.Array(MapMartiDest)),
});

export const MappedEvent = Type.Object({
    name: Type.Optional(Type.String()),
    type: Type.Optional(Type.String()),
    priority: Type.Optional(Type.Enum(CoreEvent_Priority)),
    location: Type.Optional(Type.String()),
    remarks: Type.Optional(Type.String()),
    ended: Type.Optional(Type.Union([Type.Null(), Type.String()])),
    external_id: Type.Optional(Type.String()),
    editable: Type.Optional(Type.Boolean()),
});

export const MappedDevice = Type.Object({
    name: Type.Optional(Type.String()),
    type: Type.Optional(Type.String()),
    manufacturer: Type.Optional(Type.String()),
    model: Type.Optional(Type.String()),
    serial: Type.Optional(Type.String()),
    firmware: Type.Optional(Type.String()),
    status: Type.Optional(Type.String()),
    battery: Type.Optional(Type.Number()),
    simulated: Type.Optional(Type.Boolean()),
    external_id: Type.Optional(Type.String()),
    remarks: Type.Optional(Type.String()),
});

const { TEMPLATE, LITERAL, NUMBER, BOOLEAN, ENUM, SECONDS, ZOOM, TIMESTAMP, LINKS, MARTI } = MapFieldKind;

/** Fields shared by the top level of a CoreFeature Map and each of its geometry blocks */
const FEATURE_COMMON: MapField[] = [
    { key: 'id', kind: TEMPLATE, target: 'id' },
    { key: 'callsign', kind: TEMPLATE, target: 'properties.callsign' },
    { key: 'remarks', kind: TEMPLATE, target: 'properties.remarks' },
    { key: 'phone', kind: TEMPLATE, target: 'properties.contact.phone' },
    { key: 'stale', kind: SECONDS, target: 'properties.stale' },
    { key: 'minzoom', kind: ZOOM, target: 'properties.minzoom' },
    { key: 'maxzoom', kind: ZOOM, target: 'properties.maxzoom' },
    { key: 'links', kind: LINKS, target: 'properties.links' },
    { key: 'marti', kind: MARTI, target: 'properties' },
];

function geometryBlock(block: string, geometry: MapField['geometry'], extra: MapField[]): MapField[] {
    return [...FEATURE_COMMON, ...extra].map(field => ({
        ...field,
        key: `${block}.${field.key}`,
        geometry,
    }));
}

export const MAP_FIELDS: Record<LayerMapping_Destination, MapField[]> = {
    [LayerMapping_Destination.COREFEATURE]: [
        ...FEATURE_COMMON,
        ...geometryBlock('point', 'Point', [
            { key: 'type', kind: TEMPLATE, target: 'properties.type' },
            { key: 'marker-color', kind: LITERAL, target: 'properties.marker-color' },
            { key: 'marker-opacity', kind: NUMBER, target: 'properties.marker-opacity' },
            { key: 'rotate', kind: BOOLEAN, target: 'properties.rotate' },
            { key: 'icon', kind: LITERAL, target: 'properties.icon' },
        ]),
        ...geometryBlock('line', 'LineString', [
            { key: 'type', kind: ENUM, target: 'properties.type', options: ['u-d-f', 'b-m-r'] },
            { key: 'stroke', kind: LITERAL, target: 'properties.stroke' },
            { key: 'stroke-style', kind: LITERAL, target: 'properties.stroke-style' },
            { key: 'stroke-opacity', kind: NUMBER, target: 'properties.stroke-opacity' },
            { key: 'stroke-width', kind: NUMBER, target: 'properties.stroke-width' },
        ]),
        ...geometryBlock('polygon', 'Polygon', [
            { key: 'stroke', kind: LITERAL, target: 'properties.stroke' },
            { key: 'stroke-style', kind: LITERAL, target: 'properties.stroke-style' },
            { key: 'stroke-opacity', kind: NUMBER, target: 'properties.stroke-opacity' },
            { key: 'stroke-width', kind: NUMBER, target: 'properties.stroke-width' },
            { key: 'fill', kind: LITERAL, target: 'properties.fill' },
            { key: 'fill-opacity', kind: NUMBER, target: 'properties.fill-opacity' },
        ]),
    ],
    [LayerMapping_Destination.COREEVENT]: [
        { key: 'name', kind: TEMPLATE, target: 'name', required: true },
        { key: 'type', kind: TEMPLATE, target: 'type', required: true },
        { key: 'priority', kind: ENUM, target: 'priority', options: Object.values(CoreEvent_Priority) },
        { key: 'location', kind: TEMPLATE, target: 'location' },
        { key: 'remarks', kind: TEMPLATE, target: 'remarks' },
        { key: 'ended', kind: TIMESTAMP, target: 'ended' },
        { key: 'external_id', kind: TEMPLATE, target: 'external_id' },
        { key: 'editable', kind: BOOLEAN, target: 'editable' },
    ],
    [LayerMapping_Destination.COREDEVICE]: [
        { key: 'name', kind: TEMPLATE, target: 'name', required: true },
        { key: 'type', kind: TEMPLATE, target: 'type', required: true },
        { key: 'manufacturer', kind: TEMPLATE, target: 'manufacturer' },
        { key: 'model', kind: TEMPLATE, target: 'model' },
        { key: 'serial', kind: TEMPLATE, target: 'serial' },
        { key: 'firmware', kind: TEMPLATE, target: 'firmware' },
        { key: 'status', kind: TEMPLATE, target: 'status' },
        { key: 'battery', kind: NUMBER, target: 'battery' },
        { key: 'simulated', kind: BOOLEAN, target: 'simulated' },
        { key: 'external_id', kind: TEMPLATE, target: 'external_id' },
        { key: 'remarks', kind: TEMPLATE, target: 'remarks' },
    ],
};

function getPath(obj: unknown, path: string): unknown {
    let current: unknown = obj;
    for (const part of path.split('.')) {
        if (current === null || typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[part];
    }
    return current;
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts.slice(0, -1)) {
        if (current[part] === null || typeof current[part] !== 'object') current[part] = {};
        current = current[part] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
}

function label(field: MapField): string {
    const parts = field.key.split('.');
    const name = parts[parts.length - 1]
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .replace(/\bId\b/, 'ID');

    return parts.length > 1 ? `(${parts[0]}) ${name}` : name;
}

function isNumeric(value: unknown): boolean {
    return typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value));
}

function invalid(err: unknown, message: string): Err {
    return new Err(400, err instanceof Error ? err : new Error(String(err)), message);
}

function assertTemplate(value: unknown, message: string): void {
    if (typeof value !== 'string') throw invalid(null, message);

    try {
        handlebars.compile(value)({});
    } catch (err) {
        throw invalid(err, message);
    }
}

/**
 * Apply the Layer Maps of a named Output schema to submitted Features
 *
 * Each destination is described by a list of MapFields - the engine walks the
 * fields of every Map whose JSONata query matches the Feature, in insertion
 * order, rendering templates against `properties.metadata` and writing the
 * result to the field's target
 */
export default class Mapping {
    schema: string;
    maps: Array<Static<typeof LayerMap>>;
    templates: Map<string, HandlebarsTemplateDelegate>;
    expressions: Map<string, jsonata.Expression>;

    constructor(maps: Array<Static<typeof LayerMap>>, schema: string) {
        this.schema = schema;
        this.maps = maps.filter(map => map.schema === schema);
        this.templates = new Map();
        this.expressions = new Map();
    }

    /** Does the schema have at least one Map for the destination */
    has(destination: LayerMapping_Destination): boolean {
        return this.maps.some(map => map.destination === destination && map.queries.length > 0);
    }

    /**
     * Validate a Map object against the fields of its destination
     */
    static validate(destination: LayerMapping_Destination, map: Record<string, unknown>): true {
        for (const field of MAP_FIELDS[destination]) {
            const value = getPath(map, field.key);
            if (value === undefined || value === null || value === '') continue;

            const name = label(field);

            switch (field.kind) {
                case TEMPLATE:
                case TIMESTAMP:
                    assertTemplate(value, `Invalid ${name} Template: ${value}`);
                    break;
                case LITERAL:
                    if (typeof value !== 'string') throw invalid(null, `Invalid ${name}: ${value} - Expected a string`);
                    break;
                case NUMBER:
                case SECONDS:
                    if (typeof value === 'string' && !isNumeric(value)) {
                        assertTemplate(value, `Invalid ${name} Template: ${value}`);
                    } else if (typeof value !== 'number' && typeof value !== 'string') {
                        throw invalid(null, `Invalid ${name}: ${value} - Expected a number`);
                    }
                    break;
                case ZOOM:
                    if (typeof value === 'number' || isNumeric(value)) {
                        const zoom = Number(value);
                        if (zoom < 0) throw invalid(null, `Invalid ${name}: ${zoom} - Less than 0`);
                        if (zoom > 24) throw invalid(null, `Invalid ${name}: ${zoom} - Greater than 24`);
                    } else {
                        assertTemplate(value, `Invalid ${name} Template: ${value}`);
                    }
                    break;
                case BOOLEAN:
                    if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
                        throw invalid(null, `Invalid ${name}: ${value} - Expected a boolean`);
                    }
                    break;
                case ENUM:
                    if (typeof value !== 'string' || !field.options?.includes(value)) {
                        throw invalid(null, `Invalid ${name}: ${value} - Expected one of ${field.options?.join(', ')}`);
                    }
                    break;
                case LINKS:
                    if (!Array.isArray(value)) throw invalid(null, `Invalid ${name}: Expected an array`);
                    for (const link of value as Array<Record<string, unknown>>) {
                        assertTemplate(link?.url, `Invalid Link URL: ${link?.url}`);
                        assertTemplate(link?.remarks, `Invalid Link Remarks: ${link?.remarks}`);
                    }
                    break;
                case MARTI: {
                    if (typeof value !== 'object') throw invalid(null, `Invalid ${name}: Expected an object`);
                    const marti = value as Record<string, unknown>;
                    if (marti.archive !== undefined && typeof marti.archive !== 'boolean') {
                        throw invalid(null, `Invalid ${name} Archive: Expected a boolean`);
                    }
                    if (marti.dest !== undefined && !Array.isArray(marti.dest)) {
                        throw invalid(null, `Invalid ${name} Destinations: Expected an array`);
                    }
                    break;
                }
            }
        }

        for (const block of ['', 'point.', 'line.', 'polygon.']) {
            const minzoom = getPath(map, `${block}minzoom`);
            const maxzoom = getPath(map, `${block}maxzoom`);
            if (typeof minzoom === 'number' && typeof maxzoom === 'number' && minzoom > maxzoom) {
                throw invalid(null, `Invalid zoom levels: minzoom ${minzoom} greater than maxzoom ${maxzoom}`);
            }
        }

        return true;
    }

    /**
     * Apply CoreFeature Maps to a Feature in place
     */
    async feature(feature: Static<typeof Feature.InputFeature>): Promise<Static<typeof Feature.InputFeature>> {
        if (!feature.properties) feature.properties = {};
        if (!feature.properties.metadata) feature.properties.metadata = {};

        await this.#apply(LayerMapping_Destination.COREFEATURE, feature, feature as unknown as Record<string, unknown>);

        return feature;
    }

    /**
     * CoreEvent fields produced by the Maps matching a Feature - null when no Map matched
     */
    async event(feature: MappingFeature): Promise<null | Static<typeof MappedEvent>> {
        const target: Record<string, unknown> = {};
        const matched = await this.#apply(LayerMapping_Destination.COREEVENT, feature, target);
        return matched ? target as Static<typeof MappedEvent> : null;
    }

    /**
     * CoreDevice fields produced by the Maps matching a Feature - null when no Map matched
     */
    async device(feature: MappingFeature): Promise<null | Static<typeof MappedDevice>> {
        const target: Record<string, unknown> = {};
        const matched = await this.#apply(LayerMapping_Destination.COREDEVICE, feature, target);
        return matched ? target as Static<typeof MappedDevice> : null;
    }

    /**
     * Fields of a destination that must be present when creating a record
     * but are missing from the mapped output
     */
    static missing(destination: LayerMapping_Destination, mapped: Record<string, unknown>): string[] {
        return MAP_FIELDS[destination]
            .filter(field => field.required && !mapped[field.target])
            .map(field => field.target);
    }

    async #apply(
        destination: LayerMapping_Destination,
        feature: MappingFeature,
        target: Record<string, unknown>,
    ): Promise<boolean> {
        const metadata = feature.properties?.metadata || {};
        let matched = false;

        try {
            for (const map of this.maps) {
                if (map.destination !== destination) continue;

                for (const q of map.queries) {
                    if (!await this.#matches(q.query, feature)) continue;

                    matched = true;

                    for (const field of MAP_FIELDS[destination]) {
                        if (field.geometry && feature.geometry?.type !== field.geometry) continue;

                        const raw = getPath(q.map, field.key);
                        if (raw === undefined || raw === null || raw === '') continue;

                        this.#write(field, raw, feature, target, metadata);
                    }
                }
            }
        } catch (err) {
            if (err instanceof Err) throw err;
            throw invalid(err, err instanceof Error ? err.message : String(err));
        }

        return matched;
    }

    async #matches(query: string | null, feature: MappingFeature): Promise<boolean> {
        if (query === null) return true;

        try {
            let expression = this.expressions.get(query);
            if (!expression) {
                expression = jsonata(query);
                this.expressions.set(query, expression);
            }

            return await expression.evaluate(feature) === true;
        } catch {
            // Queries that fail to evaluate against a Feature simply don't match
            return false;
        }
    }

    #write(
        field: MapField,
        raw: unknown,
        feature: MappingFeature,
        target: Record<string, unknown>,
        metadata: Record<string, unknown>,
    ): void {
        switch (field.kind) {
            case TEMPLATE:
                if (typeof raw === 'string') setPath(target, field.target, this.compile(raw, metadata));
                break;
            case LITERAL:
                if (typeof raw === 'string') setPath(target, field.target, raw);
                break;
            case ENUM:
                if (typeof raw === 'string' && field.options?.includes(raw)) setPath(target, field.target, raw);
                break;
            case BOOLEAN:
                if (typeof raw === 'boolean') setPath(target, field.target, raw);
                else if (raw === 'true' || raw === 'false') setPath(target, field.target, raw === 'true');
                break;
            case NUMBER:
            case ZOOM: {
                const number = this.#number(raw, metadata);
                if (number !== undefined) setPath(target, field.target, number);
                break;
            }
            case SECONDS: {
                if (typeof raw === 'number') {
                    setPath(target, field.target, raw * 1000);
                } else if (isNumeric(raw)) {
                    setPath(target, field.target, Number(raw) * 1000);
                } else if (typeof raw === 'string') {
                    const rendered = this.compile(raw, metadata);
                    if (isNumeric(rendered)) {
                        setPath(target, field.target, Number(rendered) * 1000);
                    } else if (rendered.trim()) {
                        setPath(target, field.target, rendered);
                    }
                }
                break;
            }
            case TIMESTAMP: {
                if (typeof raw !== 'string') break;
                const rendered = this.compile(raw, metadata).trim();
                if (!rendered) {
                    setPath(target, field.target, null);
                } else if (!isNaN(new Date(rendered).getTime())) {
                    setPath(target, field.target, new Date(rendered).toISOString());
                }
                break;
            }
            case LINKS: {
                if (!Array.isArray(raw)) break;
                const existing = getPath(target, field.target);
                const links = Array.isArray(existing) ? existing : [];
                for (const link of raw as Array<Static<typeof MapLink>>) {
                    links.push({
                        uid: feature.id,
                        relation: 'r-u',
                        mime: 'text/html',
                        url: this.compile(String(link.url ?? ''), metadata),
                        remarks: this.compile(String(link.remarks ?? ''), metadata),
                    });
                }
                setPath(target, field.target, links);
                break;
            }
            case MARTI: {
                if (raw === null || typeof raw !== 'object') break;
                const marti = raw as Static<typeof MapMarti>;
                if (marti.archive !== undefined) setPath(target, `${field.target}.marti_archive`, marti.archive);
                if (marti.dest !== undefined && marti.dest.length > 0) setPath(target, `${field.target}.dest`, marti.dest);
                break;
            }
        }
    }

    #number(raw: unknown, metadata: Record<string, unknown>): number | undefined {
        if (typeof raw === 'number') return raw;
        if (typeof raw !== 'string') return undefined;
        if (isNumeric(raw)) return Number(raw);

        const rendered = this.compile(raw, metadata);
        return isNumeric(rendered) ? Number(rendered) : undefined;
    }

    /**
     * Compile and run a template or use a cached template for performance
     */
    compile(template: string, props: Record<string, unknown>): string {
        let t = this.templates.get(template);
        if (!t) {
            t = handlebars.compile(template, { noEscape: true });
            this.templates.set(template, t);
        }

        return t(props);
    }
}
