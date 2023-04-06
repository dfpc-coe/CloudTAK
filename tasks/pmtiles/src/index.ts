import Lambda from "aws-lambda";
import S3 from "@aws-sdk/client-s3";
import pmtiles from 'pmtiles';
import zlib from "zlib";
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
    const meta_match = path.match(META);

    if (meta_match) {
        const g = meta_match.groups!;
        return { ok: true, meta: true, name: g.NAME, tile: [0, 0, 0], ext: g.EXT };
    } else {
        const match = path.match(TILE);

        if (match) {
            const g = match.groups!;
            return { ok: true, meta: false, name: g.NAME, tile: [+g.Z, +g.X, +g.Y], ext: g.EXT };
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
    return {
        statusCode: statusCode,
        body: body,
        headers: headers,
        isBase64Encoded: isBase64Encoded,
    };
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

    const headers: Headers = {};
    // TODO: metadata and TileJSON

    if (process.env.CORS) headers["Access-Control-Allow-Origin"] = process.env.CORS;

    const { ok, name, tile, ext, meta } = tile_path(path);

    if (!ok) return apiResp(400, "Invalid tile URL", false, headers);

    const source = new S3Source(name);
    const p = new pmtiles.PMTiles(source, CACHE, nativeDecompress);

    try {
        const header = await p.getHeader();
        if (tile[0] < header.minZoom || tile[0] > header.maxZoom) {
            return apiResp(404, "", false, headers);
        }

        if (meta) {
            headers["Content-Type"] = "application/json";
            return apiResp(200, JSON.stringify({
                "tilejson": "2.2.0",
                "name": `${name}.pmtiles`,
                "description": "Hosted by TAK-ETL",
                "version": "1.0.0",
                "scheme": "xyz",
                "tiles": [
                    "https://api.example.com/tiles/{z}/{x}/{y}.mvt"
                ],
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
    } catch (e) {
        if ((e as Error).name === "AccessDenied") {
            return apiResp(403, "Bucket access unauthorized", false, headers);
        }
        throw e;
    }
    return apiResp(404, "Invalid URL", false, headers);
};

export const handler = async (
    event: Lambda.APIGatewayProxyEventV2,
    context: Lambda.Context
): Promise<Lambda.APIGatewayProxyResult> => {
    return handlerRaw(event, context);
};
