import Err from '@openaddresses/batch-error';
import { PromisePool } from '@supercharge/promise-pool';
import along from '@turf/along';
import { distance } from '@turf/distance';
import { lineString, point } from '@turf/helpers';
import type { LineString } from 'geojson';
import tileCover from '@mapbox/tile-cover';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { Type } from '@sinclair/typebox';
import { Tile, Terrain } from '@tak-ps/node-tiles';
import type { Raster } from '@tak-ps/node-tiles';
import { decodeImage } from '@tak-ps/node-tiles/node';
import { fetch } from '@tak-ps/node-safeurl';
import s3client from './s3.js';

const DEFAULT_CONCURRENCY = 8;
const DEFAULT_TARGET_SAMPLES = 128;
const DEFAULT_MIN_SAMPLE_DISTANCE_KM = 0.025;
const DEFAULT_MAX_SAMPLE_DISTANCE_KM = 0.25;

type TileCoordinate = [x: number, y: number, z: number];

export type ElevationEncoding = 'mapbox' | 'terrarium';

export interface ElevationSample {
    distance: number;
    coordinate: [number, number];
    elevation: number | null;
}

export interface ElevationProfile {
    tileurl: string;
    zoom: number;
    encoding: ElevationEncoding;
    distance: number;
    stepDistance: number;
    sampledDistances: number[];
    tileCount: number;
    samples: ElevationSample[];
}

export interface ElevationProfileOptions {
    zoom: number;
    encoding: ElevationEncoding;
    concurrency?: number;
    targetSamples?: number;
    minSampleDistance?: number;
    maxSampleDistance?: number;
    distances?: number[];
}

export const ElevationEncodingType = Type.Union([
    Type.Literal('mapbox'),
    Type.Literal('terrarium'),
]);

export const LineStringGeometryType = Type.Object({
    type: Type.Literal('LineString'),
    coordinates: Type.Array(
        Type.Array(Type.Number(), { minItems: 2, maxItems: 3 }),
        { minItems: 2 },
    ),
});

export const ElevationSampleType = Type.Object({
    distance: Type.Number(),
    coordinate: Type.Tuple([Type.Number(), Type.Number()]),
    elevation: Type.Union([Type.Number(), Type.Null()]),
});

export const ElevationProfileType = Type.Object({
    tileurl: Type.String(),
    zoom: Type.Integer(),
    encoding: ElevationEncodingType,
    distance: Type.Number(),
    stepDistance: Type.Number(),
    sampledDistances: Type.Array(Type.Number()),
    tileCount: Type.Integer(),
    samples: Type.Array(ElevationSampleType),
});

interface DecodedTile {
    raster: Raster;
    terrain: Terrain;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

export type ElevationFetch = (url: string) => Promise<Pick<Response, 'ok' | 'status' | 'statusText' | 'arrayBuffer'>>;

export async function getElevationProfile(
    tileurl: string,
    geometry: LineString,
    opts: ElevationProfileOptions,
    fetchFn: ElevationFetch = url => fetch(url),
): Promise<ElevationProfile> {
    for (const token of ['{z}', '{x}', '{y}']) {
        if (!tileurl.includes(token)) {
            throw new Err(400, null, `Tile URL template must include ${token}`);
        }
    }

    if (geometry.type !== 'LineString') {
        throw new Err(400, null, 'Geometry must be a GeoJSON LineString');
    }

    if (geometry.coordinates.length < 2) {
        throw new Err(400, null, 'LineString must contain at least two coordinates');
    }

    if (!Number.isInteger(opts.zoom) || opts.zoom < 0) {
        throw new Err(400, null, 'Zoom must be a non-negative integer');
    }

    if (!opts.encoding) {
        throw new Err(400, null, 'Encoding must be specified by the caller');
    }

    const encoding = opts.encoding;
    let totalDistance = 0;
    for (let i = 1; i < geometry.coordinates.length; i++) {
        const start = geometry.coordinates[i - 1];
        const end = geometry.coordinates[i];
        totalDistance += distance(point([start[0], start[1]]), point([end[0], end[1]]), { units: 'kilometers' });
    }

    let stepDistance: number;
    let distances: number[];

    if (opts.distances?.length) {
        const requestedDistances = opts.distances
            .filter(value => Number.isFinite(value))
            .map(value => clamp(value, 0, totalDistance))
            .sort((a, b) => a - b);

        if (!requestedDistances.length) {
            throw new Err(400, null, 'Provided sample distances are invalid');
        }

        stepDistance = requestedDistances.length > 1 ? requestedDistances[1] - requestedDistances[0] : 0;
        distances = Array.from(new Set(requestedDistances.map(value => Number(value.toFixed(6)))));
    } else {
        const minSampleDistance = opts.minSampleDistance ?? DEFAULT_MIN_SAMPLE_DISTANCE_KM;
        const maxSampleDistance = opts.maxSampleDistance ?? DEFAULT_MAX_SAMPLE_DISTANCE_KM;

        if (minSampleDistance <= 0 || maxSampleDistance <= 0) {
            throw new Err(400, null, 'Sample distance bounds must be greater than zero');
        }

        if (minSampleDistance > maxSampleDistance) {
            throw new Err(400, null, 'Minimum sample distance cannot exceed maximum sample distance');
        }

        if (totalDistance === 0) {
            stepDistance = 0;
            distances = [0];
        } else {
            const targetSamples = Math.max(2, opts.targetSamples ?? DEFAULT_TARGET_SAMPLES);
            stepDistance = clamp(totalDistance / targetSamples, minSampleDistance, maxSampleDistance);
            const sampledDistances: number[] = [];

            for (let offset = 0; offset < totalDistance; offset += stepDistance) {
                sampledDistances.push(Number(offset.toFixed(6)));
            }

            sampledDistances.push(Number(totalDistance.toFixed(6)));
            distances = Array.from(new Set(sampledDistances));
        }
    }

    const line = lineString(geometry.coordinates.map(coordinate => [coordinate[0], coordinate[1]]));
    const tiles = tileCover.tiles(geometry, {
        min_zoom: opts.zoom,
        max_zoom: opts.zoom,
    }) as TileCoordinate[];

    const { results } = await PromisePool
        .withConcurrency(opts.concurrency ?? DEFAULT_CONCURRENCY)
        .for(tiles)
        .process(async (tile) => {
            const flippedY = (1 << tile[2]) - tile[1] - 1;
            const resolved = tileurl
                .replaceAll('{z}', String(tile[2]))
                .replaceAll('{x}', String(tile[0]))
                .replaceAll('{y}', String(tile[1]))
                .replaceAll('{-y}', String(flippedY));

            let buffer: Buffer | null;
            if (resolved.startsWith('s3://')) {
                const url = new URL(resolved);
                const bucket = url.hostname;
                const key = url.pathname.replace(/^\/+/, '');

                if (!bucket || !key) {
                    throw new Err(400, null, 'Invalid S3 tile URL template');
                }

                try {
                    const client = s3client();
                    const response = await client.send(new GetObjectCommand({
                        Bucket: bucket,
                        Key: key,
                    }));

                    buffer = response.Body ? Buffer.from(await response.Body.transformToByteArray()) : null;
                } catch (err) {
                    if (err instanceof Error && err.name === 'NoSuchKey') return null;
                    throw new Err(502, err instanceof Error ? err : new Error(String(err)), 'Failed to fetch tile from S3');
                }
            } else {
                const response = await fetchFn(resolved);

                if (response.status === 204 || response.status === 404) return null;
                if (!response.ok) {
                    throw new Err(502, null, `Failed to fetch tile: ${response.status} ${response.statusText}`);
                }

                buffer = Buffer.from(await response.arrayBuffer());
            }

            if (!buffer) return null;

            let raster: Raster;
            try {
                raster = await decodeImage(buffer);
            } catch (err) {
                throw new Err(400, err instanceof Error ? err : new Error(String(err)), 'Tile is not a supported raster image');
            }

            let terrain: Terrain;
            try {
                terrain = Terrain.decode(new Tile(tile[2], tile[0], tile[1]), raster, encoding);
            } catch (err) {
                throw new Err(400, err instanceof Error ? err : new Error(String(err)), 'Tile is not a square RGB raster-dem tile');
            }

            return { raster, terrain } satisfies DecodedTile;
        });

    const tileMap = new Map<string, DecodedTile>();
    for (const tile of results) {
        if (!tile) continue;
        tileMap.set(tile.terrain.tile.key, tile);
    }

    const samples = distances.map((sampleDistance) => {
        const sampledPoint = along(line, sampleDistance, { units: 'kilometers' });
        const coordinate = sampledPoint.geometry.coordinates as [number, number];
        const tile = tileMap.get(Tile.fromLngLat(coordinate[0], coordinate[1], opts.zoom).key);

        let elevation: number | null = null;
        if (tile) {
            const { raster, terrain } = tile;
            const [fx, fy] = terrain.tile.project(coordinate[0], coordinate[1], terrain.size);
            const px = clamp(Math.floor(fx), 0, terrain.size - 1);
            const py = clamp(Math.floor(fy), 0, terrain.size - 1);

            if (raster.channels < 4 || raster.get(px, py)[3] !== 0) {
                elevation = terrain.at(px, py);
            }
        }

        return {
            distance: sampleDistance,
            coordinate,
            elevation,
        } satisfies ElevationSample;
    });

    return {
        tileurl,
        zoom: opts.zoom,
        encoding,
        distance: totalDistance,
        stepDistance,
        sampledDistances: distances,
        tileCount: tileMap.size,
        samples,
    };
}

export default getElevationProfile;
