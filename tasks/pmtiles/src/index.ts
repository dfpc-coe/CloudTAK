import Lambda from "aws-lambda";
import jwt from 'jsonwebtoken';
import S3 from "@aws-sdk/client-s3";
import pmtiles from 'pmtiles';
import zlib from "zlib";
// @ts-ignore
import vtquery from '@mapbox/vtquery';
import TB from '@mapbox/tilebelt';
import { NodeHttpHandler } from "@aws-sdk/node-http-handler";

// the region should default to the same one as the function
const s3client = new S3.S3Client({
    requestHandler: new NodeHttpHandler({
        connectionTimeout: 500,
        socketTimeout: 500,
    }),
});

async function nativeDecompress(
    buf: ArrayBuffer,
    compression: pmtiles.Compression
): Promise<ArrayBuffer> {
    if (compression === pmtiles.Compression.None || compression === pmtiles.Compression.Unknown) {
        return buf;
    } else if (compression === pmtiles.Compression.Gzip) {
        return zlib.gunzipSync(buf);
    } else {
        throw Error("Compression method not supported");
    }
}

// Lambda needs to run with 512MB, empty function takes about 70
const CACHE = new pmtiles.ResolvedValueCache(undefined, undefined, nativeDecompress);
const TILE = /^\/(?<NAME>[0-9a-zA-Z\/!\-_\.\*\'\(\)]+)\/(?<Z>\d+)\/(?<X>\d+)\/(?<Y>\d+).(?<EXT>[a-z]+)$/;
const META = /^\/(?<NAME>[0-9a-zA-Z\/!\-_\.\*\'\(\)]+)$/;

export const tile_path = (
    path: string,
): {
    ok: boolean;
    meta: boolean;
    name: string;
    tile: [number, number, number];
    ext: string;
} => {
    const match = path.match(TILE);

    if (match) {
        const g = match.groups!;
        return { ok: true, meta: false, name: g.NAME, tile: [+g.Z, +g.X, +g.Y], ext: g.EXT };
    } else {
        const meta_match = path.match(META);

        if (meta_match) {
            const g = meta_match.groups!;
            return { ok: true, meta: true, name: g.NAME, tile: [0, 0, 0], ext: g.EXT };
        } else {
            return { ok: false, meta: false, name: "", tile: [0, 0, 0], ext: "" };
        }
    }

};

class S3Source implements pmtiles.Source {
    archive_name: string;

    constructor(archive_name: string) {
        this.archive_name = archive_name;
    }

    getKey() {
        return this.archive_name;
    }

    async getBytes(offset: number, length: number): Promise<pmtiles.RangeResponse> {
        const resp = await s3client.send(
            new S3.GetObjectCommand({
                Bucket: process.env.BUCKET!,
                Key: this.archive_name + '.pmtiles',
                Range: "bytes=" + offset + "-" + (offset + length - 1),
            })
        );

        const arr = await resp.Body!.transformToByteArray();

        return {
            data: arr.buffer,
            etag: resp.ETag,
            expires: resp.Expires?.toISOString(),
            cacheControl: resp.CacheControl,
        };
    }
}

interface Headers {
    [key: string]: string;
}

const apiResp = (
    statusCode: number,
    body: string,
    isBase64Encoded = false,
    headers: Headers = {}
): Lambda.APIGatewayProxyResult => {
    return { statusCode, body, headers, isBase64Encoded };
};

// Assumes event is a API Gateway V2 or Lambda Function URL formatted dict
// and returns API Gateway V2 / Lambda Function dict responses
export const handlerRaw = async (
    event: Lambda.APIGatewayProxyEventV2,
    context: Lambda.Context,
    tilePostprocess?: (a: ArrayBuffer, t: pmtiles.TileType) => ArrayBuffer
): Promise<Lambda.APIGatewayProxyResult> => {
    let path;

    if (event && event.pathParameters && event.pathParameters.proxy) {
        path = "/" + event.pathParameters.proxy;
    } else {
        return apiResp(500, "Proxy integration missing tile_path parameter");
    }

    if (!path) return apiResp(500, "Invalid event configuration");

    const headers: Headers = {
        "Access-Control-Allow-Origin": '*',
        "Access-Control-Allow-Credentials": 'true'
    };

    if (!event.queryStringParameters || !event.queryStringParameters.token) {
        return apiResp(400, JSON.stringify({
            status: 400,
            message: 'token query param required'
        }));
    }

    try {
        jwt.verify(event.queryStringParameters.token, process.env.SigningSecret);
    } catch (err) {
        return apiResp(401, JSON.stringify({
            status: 401,
            message: 'Invalid token'
        }));
    }

    const { ok, name, tile, ext, meta } = tile_path(path);

    if (!ok) return apiResp(400, "Invalid tile URL", false, headers);

    const source = new S3Source(name);
    const p = new pmtiles.PMTiles(source, CACHE, nativeDecompress);

    try {
        const header = await p.getHeader();
        if (tile[0] < header.minZoom || tile[0] > header.maxZoom) {
            return apiResp(404, "", false, headers);
        }

        if (meta && event.queryStringParameters && event.queryStringParameters.query) {
            headers["Content-Type"] = "application/json";

            const query: {
                lnglat: number[],
                zoom: number,
                limit: number
            } = {
                lnglat: [],
                zoom: event.queryStringParameters.zoom ? parseInt(event.queryStringParameters.zoom) : header.maxZoom,
                limit: event.queryStringParameters.limit ? parseInt(event.queryStringParameters.limit) : 1,
            }

            const lnglat: number[] = event.queryStringParameters.query
                .split(',')
                .map((comp) => { return Number(comp) });

            if (lnglat.length !== 2) return apiResp(400, "Invalid LngLat", false, headers);
            if (isNaN(lnglat[0]) || isNaN(lnglat[1])) return apiResp(400, "Invalid LngLat (Non-Numeric)", false, headers);
            query.lnglat = lnglat;
            if (isNaN(query.zoom)) return apiResp(400, "Invalid Integer Zoom", false, headers);
            if (isNaN(query.limit)) return apiResp(400, "Invalid Integer Limit", false, headers);
            if (query.zoom > header.maxZoom) return apiResp(400, "Above Layer MaxZoom", false, headers);
            if (query.zoom < header.minZoom) return apiResp(400, "Below Layer MinZoom", false, headers);

            const xyz = TB.pointToTile(query.lnglat[0], query.lnglat[1], query.zoom)
            const tile = await p.getZxy(xyz[2], xyz[0], xyz[1]);

            const meta = {
                x: xyz[0],
                y: xyz[1],
                z: xyz[2]
            };

            if (!tile) {
                return apiResp(200, JSON.stringify({
                    type: 'FeatureCollection',
                    query,
                    meta,
                    features: []
                }), false, headers);
            }

            const fc: any = await new Promise((resolve, reject) => {
                vtquery([
                    { buffer: tile.data, z: xyz[2], x: xyz[0], y: xyz[1] }
                ], query.lnglat, {
                    limit: query.limit
                }, (err: Error, fc: {
                    type: string,
                    features: object[]
                }) => {
                    if (err) return reject(err);
                    return resolve(fc);
                });
            });

            fc.query = query;
            fc.meta = meta;

            return apiResp(200, JSON.stringify(fc), false, headers);
        } else if (meta) {
            headers["Content-Type"] = "application/json";
            return apiResp(200, JSON.stringify({
                "tilejson": "2.2.0",
                "name": `${name}.pmtiles`,
                "description": "Hosted by TAK-ETL",
                "version": "1.0.0",
                "scheme": "xyz",
                "tiles": [ process.env.APIROOT + `/tiles${path}/{z}/{x}/{y}.mvt?token=${event.queryStringParameters.token}`],
                "minzoom": header.minZoom,
                "maxzoom": header.maxZoom,
                "bounds": [
                    header.minLon,
                    header.minLat,
                    header.maxLon,
                    header.maxLat
                ],
                "meta": header,
                "center": [
                    header.centerLon,
                    header.centerLat,
                    header.centerZoom
                ]
            }), false, headers);
        }

        for (const pair of [
            [pmtiles.TileType.Mvt, "mvt"],
            [pmtiles.TileType.Png, "png"],
            [pmtiles.TileType.Jpeg, "jpg"],
            [pmtiles.TileType.Webp, "webp"],
        ]) {
            if (header.tileType === pair[0] && ext !== pair[1]) {
                if (header.tileType == pmtiles.TileType.Mvt && ext === "pbf") {
                    // allow this for now. Eventually we will delete this in favor of .mvt
                    continue;
                }
                return apiResp(
                    400,
                    "Bad request: archive has type ." + pair[1],
                    false,
                    headers
                );
            }
        }

        const tile_result = await p.getZxy(tile[0], tile[1], tile[2]);
        if (tile_result) {
            switch (header.tileType) {
                case pmtiles.TileType.Mvt:
                    // part of the list of Cloudfront compressible types.
                    headers["Content-Type"] = "application/vnd.mapbox-vector-tile";
                break;
                case pmtiles.TileType.Png:
                    headers["Content-Type"] = "image/png";
                break;
                case pmtiles.TileType.Jpeg:
                    headers["Content-Type"] = "image/jpeg";
                break;
                case pmtiles.TileType.Webp:
                    headers["Content-Type"] = "image/webp";
                break;
            }

            let data = tile_result.data;

            if (tilePostprocess) {
                data = tilePostprocess(data, header.tileType);
            }

            // We need to force API Gateway to interpret the Lambda response as binary
            // without depending on clients sending matching Accept: headers in the request.
            const recompressed_data = zlib.gzipSync(data);
            headers["Content-Encoding"] = "gzip";
            return apiResp(
                200,
                Buffer.from(recompressed_data).toString("base64"),
                true,
                headers
            );
        } else {
            return apiResp(204, "", false, headers);
        }
    } catch (err: any) {
        if ((err as Error).name === "AccessDenied") {
            return apiResp(403, "Bucket access unauthorized", false, headers);
        }

        console.error(err);

        if ((err as Error) && err.message) {
            headers["Content-Type"] = 'application/json';
            return apiResp(500, JSON.stringify({
                status: 500,
                message: err.message
            }), false, headers);
        } else {
            throw err;
        }
    }
    return apiResp(404, "Invalid URL", false, headers);
};

export const handler = async (
    event: Lambda.APIGatewayProxyEventV2,
    context: Lambda.Context
): Promise<Lambda.APIGatewayProxyResult> => {
    return handlerRaw(event, context);
};
