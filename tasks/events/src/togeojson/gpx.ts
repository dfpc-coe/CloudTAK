import type { Feature, LineString, MultiLineString, Point, Position } from 'geojson';
import type { FC } from './types.ts';
import { type P, get, getMulti, num1, val1, $num } from './shared.ts';
import {
    type XmlElement,
    type XmlNode,
    $,
    $ns,
    childElements,
    get1,
    getAttribute,
    nodeVal,
    parseXml,
} from './xml.ts';

type NamespaceList = Array<[string, string]>;

type ExtendedValues = Array<[string, string | number]>;

function getExtensions(node: XmlNode | null): ExtendedValues {
    let values: ExtendedValues = [];
    if (node === null) return values;
    for (const child of childElements(node)) {
        const name = abbreviateName(child.name);
        if (name === 'gpxtpx:TrackPointExtension') {
            // loop again for nested garmin extensions (eg. "gpxtpx:hr")
            values = values.concat(getExtensions(child));
        } else {
            // push custom extension (eg. "power")
            const val = nodeVal(child);
            values.push([name, parseNumeric(val)]);
        }
    }
    return values;
}

function abbreviateName(name: string): string {
    return ['heart', 'gpxtpx:hr', 'hr'].includes(name) ? 'heart' : name;
}

function parseNumeric(val: string): string | number {
    const num = Number.parseFloat(val);
    return Number.isNaN(num) ? val : num;
}

function coordPair(node: XmlElement): {
    coordinates: Position;
    time: string | null;
    extendedValues: ExtendedValues;
} | null {
    const ll = [
        Number.parseFloat(getAttribute(node, 'lon') || ''),
        Number.parseFloat(getAttribute(node, 'lat') || ''),
    ];
    if (Number.isNaN(ll[0]) || Number.isNaN(ll[1])) {
        return null;
    }
    num1(node, 'ele', (val) => {
        ll.push(val);
    });
    const time = get1(node, 'time');
    return {
        coordinates: ll,
        time: time ? nodeVal(time) : null,
        extendedValues: getExtensions(get1(node, 'extensions')),
    };
}

function getLineStyle(node: XmlElement | null): P {
    return get(node, 'line', (lineStyle) => {
        const val = Object.assign(
            {},
            val1(lineStyle, 'color', (color) => {
                return { stroke: `#${color}` };
            }),
            $num(lineStyle, 'opacity', (opacity) => {
                return { 'stroke-opacity': opacity };
            }),
            $num(lineStyle, 'width', (width) => {
                // GPX width is in mm, convert to px with 96 px per inch
                return { 'stroke-width': (width * 96) / 25.4 };
            }),
        );
        return val;
    });
}

function extractProperties(ns: NamespaceList, node: XmlNode): P {
    const properties = getMulti(node, [
        'name',
        'cmt',
        'desc',
        'type',
        'time',
        'keywords',
    ]);

    for (const [, url] of ns) {
        for (const child of $ns(node, '*', url)) {
            properties[child.name.replace(':', '_')] = nodeVal(child)?.trim();
        }
    }

    const links = $(node, 'link');
    if (links.length) {
        properties.links = links.map(link =>
            Object.assign({ href: getAttribute(link, 'href') }, getMulti(link, ['text', 'type'])),
        );
    }

    return properties;
}

interface Line {
    line: Position[];
    times: string[];
    extendedValues: Record<string, Array<string | number | null>>;
}

/**
 * Extract points from a trkseg or rte element.
 */
function getPoints(node: XmlNode, pointname: 'trkpt' | 'rtept'): Line | undefined {
    const pts = $(node, pointname);
    const line: Position[] = [];
    const times: string[] = [];
    const extendedValues: Line['extendedValues'] = {};

    for (let i = 0; i < pts.length; i++) {
        const c = coordPair(pts[i]);
        if (!c) {
            continue;
        }
        line.push(c.coordinates);
        if (c.time) times.push(c.time);
        for (const [name, val] of c.extendedValues) {
            const plural = name === 'heart' ? name : `${name.replace('gpxtpx:', '')}s`;
            if (!extendedValues[plural]) {
                extendedValues[plural] = Array(pts.length).fill(null);
            }
            extendedValues[plural][i] = val;
        }
    }

    if (line.length < 2) return; // Invalid line in GeoJSON

    return {
        line,
        times,
        extendedValues,
    };
}

/**
 * Extract a LineString geometry from a rte
 * element.
 */
function getRoute(ns: NamespaceList, node: XmlElement): Feature<LineString> | undefined {
    const line = getPoints(node, 'rtept');
    if (!line) return;
    return {
        type: 'Feature',
        properties: Object.assign(
            { _gpxType: 'rte' },
            extractProperties(ns, node),
            getLineStyle(get1(node, 'extensions')),
        ),
        geometry: {
            type: 'LineString',
            coordinates: line.line,
        },
    };
}

function getTrack(ns: NamespaceList, node: XmlElement): Feature<LineString | MultiLineString> | null {
    const segments = $(node, 'trkseg');
    const track: Position[][] = [];
    const times: string[][] = [];
    const extractedLines: Line[] = [];

    for (const segment of segments) {
        const line = getPoints(segment, 'trkpt');
        if (line) {
            extractedLines.push(line);
            if (line.times?.length) times.push(line.times);
        }
    }

    if (extractedLines.length === 0) return null;

    const multi = extractedLines.length > 1;

    const properties: P = Object.assign(
        { _gpxType: 'trk' },
        extractProperties(ns, node),
        getLineStyle(get1(node, 'extensions')),
        times.length
            ? {
                    coordinateProperties: {
                        times: multi ? times : times[0],
                    },
                }
            : {},
    );

    for (let i = 0; i < extractedLines.length; i++) {
        const line = extractedLines[i];
        track.push(line.line);
        if (!properties.coordinateProperties) {
            properties.coordinateProperties = {};
        }
        const props = properties.coordinateProperties as Record<string, unknown>;
        // Generally extendedValues will be things like heart
        // rate, and this is an array like { heart: [100, 101...] }
        for (const [name, val] of Object.entries(line.extendedValues)) {
            if (multi) {
                if (!props[name]) {
                    props[name] = extractedLines.map(l => new Array(l.line.length).fill(null));
                }
                (props[name] as unknown[])[i] = val;
            } else {
                props[name] = val;
            }
        }
    }

    return {
        type: 'Feature',
        properties,
        geometry: multi
            ? {
                    type: 'MultiLineString',
                    coordinates: track,
                }
            : {
                    type: 'LineString',
                    coordinates: track[0],
                },
    };
}

/**
 * Extract a point, if possible, from a given node,
 * which is usually a wpt or trkpt
 */
function getPoint(ns: NamespaceList, node: XmlElement): Feature<Point> | null {
    const properties: P = Object.assign(extractProperties(ns, node), getMulti(node, ['sym']));
    const pair = coordPair(node);
    if (!pair) return null;
    return {
        type: 'Feature',
        properties,
        geometry: {
            type: 'Point',
            coordinates: pair.coordinates,
        },
    };
}

/**
 * Convert GPX to GeoJSON incrementally, returning
 * a [Generator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Iterators_and_Generators)
 * that yields output feature by feature.
 */
export function* gpxGen(input: string | XmlNode): Generator<Feature<Point | LineString | MultiLineString>> {
    const n = typeof input === 'string' ? parseXml(input) : input;

    const GPXX = 'gpxx';
    const GPXX_URI = 'http://www.garmin.com/xmlschemas/GpxExtensions/v3';
    // Namespaces
    const ns: NamespaceList = [[GPXX, GPXX_URI]];
    const attrs = get1(n, 'gpx')?.attributes;
    if (attrs) {
        for (const [name, value] of Object.entries(attrs)) {
            if (name.startsWith('xmlns:') && String(value) !== GPXX_URI) {
                ns.push([name, String(value)]);
            }
        }
    }

    for (const track of $(n, 'trk')) {
        const feature = getTrack(ns, track);
        if (feature) yield feature;
    }
    for (const route of $(n, 'rte')) {
        const feature = getRoute(ns, route);
        if (feature) yield feature;
    }
    for (const waypoint of $(n, 'wpt')) {
        const point = getPoint(ns, waypoint);
        if (point) yield point;
    }
}

/**
 * Convert a GPX document to GeoJSON. The first argument must be the GPX
 * document as an XML string (or an already-parsed tree from parseXml).
 *
 * The output is a JavaScript object of GeoJSON data, same as `.kml` outputs, with the
 * addition of a `_gpxType` property on each `LineString` feature that indicates whether
 * the feature was encoded as a route (`rte`) or track (`trk`) in the GPX document.
 */
export function gpx(input: string | XmlNode): FC {
    return {
        type: 'FeatureCollection',
        features: Array.from(gpxGen(input)),
    };
}
