import type { Feature, LineString, MultiLineString, Position } from 'geojson';
import type { FC } from './types.ts';
import { type P, get, num1 } from './shared.ts';
import { type XmlElement, type XmlNode, $, $ns, get1, nodeVal, parseXml } from './xml.ts';

const EXTENSIONS_NS = 'http://www.garmin.com/xmlschemas/ActivityExtension/v2';

const TRACKPOINT_ATTRIBUTES: Array<[string, string]> = [
    ['heartRate', 'heartRates'],
    ['Cadence', 'cadences'],
    // Extended Trackpoint attributes
    ['Speed', 'speeds'],
    ['Watts', 'watts'],
];

const LAP_ATTRIBUTES: Array<[string, string]> = [
    ['TotalTimeSeconds', 'totalTimeSeconds'],
    ['DistanceMeters', 'distanceMeters'],
    ['MaximumSpeed', 'maxSpeed'],
    ['AverageHeartRateBpm', 'avgHeartRate'],
    ['MaximumHeartRateBpm', 'maxHeartRate'],
    // Extended Lap attributes
    ['AvgSpeed', 'avgSpeed'],
    ['AvgWatts', 'avgWatts'],
    ['MaxWatts', 'maxWatts'],
];

function getProperties(node: XmlNode, attributeNames: Array<[string, string]>): Array<[string, number]> {
    const properties: Array<[string, number]> = [];

    for (const [tag, alias] of attributeNames) {
        let elem: XmlElement | null = get1(node, tag);
        if (!elem) {
            const elements = $ns(node, tag, EXTENSIONS_NS);
            if (elements.length) {
                elem = elements[0];
            }
        }
        const val = Number.parseFloat(nodeVal(elem));
        if (!Number.isNaN(val)) {
            properties.push([alias, val]);
        }
    }

    return properties;
}

function coordPair(node: XmlNode): {
    coordinates: Position;
    time: string | null;
    heartRate: number | null;
    extensions: Array<[string, number]>;
} | null {
    const ll = [num1(node, 'LongitudeDegrees'), num1(node, 'LatitudeDegrees')];
    if (
        ll[0] === undefined
        || Number.isNaN(ll[0])
        || ll[1] === undefined
        || Number.isNaN(ll[1])
    ) {
        return null;
    }
    const heartRate = get1(node, 'HeartRateBpm');
    const time = nodeVal(get1(node, 'Time'));
    get1(node, 'AltitudeMeters', (alt) => {
        const a = Number.parseFloat(nodeVal(alt));
        if (!Number.isNaN(a)) {
            ll.push(a);
        }
    });
    return {
        coordinates: ll as Position,
        time: time || null,
        heartRate: heartRate ? Number.parseFloat(nodeVal(heartRate)) : null,
        extensions: getProperties(node, TRACKPOINT_ATTRIBUTES),
    };
}

interface Line {
    line: Position[];
    times: string[];
    heartRates: number[];
    extendedProperties: Record<string, Array<number | null>>;
}

function getPoints(node: XmlNode): Line | null {
    const pts = $(node, 'Trackpoint');
    const line: Position[] = [];
    const times: string[] = [];
    const heartRates: number[] = [];
    if (pts.length < 2) return null; // Invalid line in GeoJSON

    const extendedProperties: Line['extendedProperties'] = {};

    for (let i = 0; i < pts.length; i++) {
        const c = coordPair(pts[i]);
        if (c === null) continue;
        line.push(c.coordinates);
        const { time, heartRate, extensions } = c;
        if (time) times.push(time);
        if (heartRate) heartRates.push(heartRate);
        for (const [alias, value] of extensions) {
            if (!extendedProperties[alias]) {
                extendedProperties[alias] = Array(pts.length).fill(null);
            }
            extendedProperties[alias][i] = value;
        }
    }

    if (line.length < 2) return null;

    return {
        line,
        times,
        heartRates,
        extendedProperties,
    };
}

function getLap(node: XmlNode): Feature<LineString | MultiLineString> | null {
    const segments = $(node, 'Track');
    const track: Position[][] = [];
    const times: string[][] = [];
    const heartRates: number[][] = [];
    const allExtendedProperties: Array<Line['extendedProperties']> = [];
    let line: Line | null = null;

    const properties: P = Object.assign(
        Object.fromEntries(getProperties(node, LAP_ATTRIBUTES)),
        get(node, 'Name', (nameElement) => {
            return { name: nodeVal(nameElement) };
        }),
    );

    for (const segment of segments) {
        line = getPoints(segment);
        if (line) {
            track.push(line.line);
            if (line.times.length) times.push(line.times);
            if (line.heartRates.length) heartRates.push(line.heartRates);
            allExtendedProperties.push(line.extendedProperties);
        }
    }

    for (let i = 0; i < allExtendedProperties.length; i++) {
        const extendedProperties = allExtendedProperties[i];
        for (const property in extendedProperties) {
            if (segments.length === 1) {
                if (line) {
                    properties[property] = line.extendedProperties[property];
                }
            } else {
                if (!properties[property]) {
                    properties[property] = track.map(t => Array(t.length).fill(null));
                }
                (properties[property] as unknown[])[i] = extendedProperties[property];
            }
        }
    }

    if (track.length === 0) return null;

    if (times.length || heartRates.length) {
        properties.coordinateProperties = Object.assign(
            times.length
                ? {
                        times: track.length === 1 ? times[0] : times,
                    }
                : {},
            heartRates.length
                ? {
                        heart: track.length === 1 ? heartRates[0] : heartRates,
                    }
                : {},
        );
    }

    return {
        type: 'Feature',
        properties,
        geometry: track.length === 1
            ? {
                    type: 'LineString',
                    coordinates: track[0],
                }
            : {
                    type: 'MultiLineString',
                    coordinates: track,
                },
    };
}

/**
 * Incrementally convert a TCX document to GeoJSON. The first argument must be
 * the TCX document as an XML string (or an already-parsed tree from parseXml).
 */
export function* tcxGen(input: string | XmlNode): Generator<Feature<LineString | MultiLineString>> {
    const n = typeof input === 'string' ? parseXml(input) : input;

    for (const lap of $(n, 'Lap')) {
        const feature = getLap(lap);
        if (feature) yield feature;
    }

    for (const course of $(n, 'Courses')) {
        const feature = getLap(course);
        if (feature) yield feature;
    }
}

/**
 * Convert a TCX document to GeoJSON. The first argument must be the TCX
 * document as an XML string (or an already-parsed tree from parseXml).
 */
export function tcx(input: string | XmlNode): FC {
    return {
        type: 'FeatureCollection',
        features: Array.from(tcxGen(input)),
    };
}
