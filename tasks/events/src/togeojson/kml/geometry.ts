import type { Geometry, LineString, Point, Position } from 'geojson';
import { type XmlNode, $, $ns, childElements, get1, nodeVal } from '../xml.ts';

const removeSpace = /\s*/g;
const trimSpace = /^\s*|\s*$/g;
const splitSpace = /\s+/;

/**
 * Get one coordinate from a coordinate array, if any
 */
export function coord1(value: string): Position {
    return value
        .replace(removeSpace, '')
        .split(',')
        .map(Number.parseFloat)
        .filter(num => !Number.isNaN(num))
        .slice(0, 3);
}

/**
 * Get all coordinates from a coordinate array as [[],[]]
 */
export function coord(value: string): Position[] {
    return value
        .replace(trimSpace, '')
        .split(splitSpace)
        .map(coord1)
        .filter((coordinate) => {
            return coordinate.length >= 2;
        });
}

function gxCoords(node: XmlNode): { geometry: LineString | Point; times: string[] } | null {
    let elems = $(node, 'coord');
    if (elems.length === 0) {
        elems = $ns(node, 'coord', '*');
    }
    const coordinates = elems.map((elem) => {
        return nodeVal(elem).split(' ').map(Number.parseFloat);
    });
    if (coordinates.length === 0) {
        return null;
    }
    return {
        geometry: coordinates.length > 2
            ? {
                    type: 'LineString',
                    coordinates,
                }
            : {
                    type: 'Point',
                    coordinates: coordinates[0],
                },
        times: $(node, 'when').map(elem => nodeVal(elem)),
    };
}

export function fixRing(ring: Position[]): Position[] {
    if (ring.length === 0) return ring;
    const first = ring[0];
    const last = ring[ring.length - 1];
    let equal = true;
    for (let i = 0; i < Math.max(first.length, last.length); i++) {
        if (first[i] !== last[i]) {
            equal = false;
            break;
        }
    }
    if (!equal) {
        return ring.concat([ring[0]]);
    }
    return ring;
}

export function getCoordinates(node: XmlNode): string {
    return nodeVal(get1(node, 'coordinates'));
}

export function getGeometry(node: XmlNode): { geometries: Geometry[]; coordTimes: string[][] } {
    let geometries: Geometry[] = [];
    let coordTimes: string[][] = [];

    for (const child of childElements(node)) {
        switch (child.name) {
            case 'MultiGeometry':
            case 'MultiTrack':
            case 'gx:MultiTrack': {
                const childGeometries = getGeometry(child);
                geometries = geometries.concat(childGeometries.geometries);
                coordTimes = coordTimes.concat(childGeometries.coordTimes);
                break;
            }
            case 'Point': {
                const coordinates = coord1(getCoordinates(child));
                if (coordinates.length >= 2) {
                    geometries.push({
                        type: 'Point',
                        coordinates,
                    });
                }
                break;
            }
            case 'LinearRing':
            case 'LineString': {
                const coordinates = coord(getCoordinates(child));
                if (coordinates.length >= 2) {
                    geometries.push({
                        type: 'LineString',
                        coordinates,
                    });
                }
                break;
            }
            case 'Polygon': {
                const coords: Position[][] = [];
                for (const linearRing of $(child, 'LinearRing')) {
                    const ring = fixRing(coord(getCoordinates(linearRing)));
                    if (ring.length >= 4) {
                        coords.push(ring);
                    }
                }
                if (coords.length) {
                    geometries.push({
                        type: 'Polygon',
                        coordinates: coords,
                    });
                }
                break;
            }
            case 'Track':
            case 'gx:Track': {
                const gx = gxCoords(child);
                if (!gx) break;
                const { times, geometry } = gx;
                geometries.push(geometry);
                if (times.length) coordTimes.push(times);
                break;
            }
        }
    }

    return {
        geometries,
        coordTimes,
    };
}
