import * as pmtiles from 'pmtiles';
import zlib from "zlib";

export async function nativeDecompress(
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
export const CACHE = new pmtiles.ResolvedValueCache(undefined, undefined, nativeDecompress);

export class S3Source implements pmtiles.Source {
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

/*
    try {
        const header = await p.getHeader();
        if (!meta && (tile[0] < header.minZoom || tile[0] > header.maxZoom)) {
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

            if (lnglat.length !== 2) return apiError(400, "Invalid LngLat");
            if (isNaN(lnglat[0]) || isNaN(lnglat[1])) return apiError(400, "Invalid LngLat (Non-Numeric)");
            query.lnglat = lnglat;
            if (isNaN(query.zoom)) return apiError(400, "Invalid Integer Zoom");
            if (isNaN(query.limit)) return apiError(400, "Invalid Integer Limit");
            if (query.zoom > header.maxZoom) return apiError(400, "Above Layer MaxZoom");
            if (query.zoom < header.minZoom) return apiError(400, "Below Layer MinZoom");

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

            let format = 'mvt';
            for (const pair of [
                [pmtiles.TileType.Mvt, "mvt"],
                [pmtiles.TileType.Png, "png"],
                [pmtiles.TileType.Jpeg, "jpg"],
                [pmtiles.TileType.Webp, "webp"],
            ]) {
                if (header.tileType === pair[0]) format = pair[1];
            }

            return apiResp(200, JSON.stringify({
                "tilejson": "2.2.0",
                "name": `${name}.pmtiles`,
                "description": "Hosted by TAK-ETL",
                "version": "1.0.0",
                "scheme": "xyz",
                "tiles": [ process.env.APIROOT + `/tiles${path}/{z}/{x}/{y}.${format}?token=${event.queryStringParameters.token}`],
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
                return apiError(400, "Bad request: archive has type ." + pair[1]);
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
            return apiError(403, "Bucket access unauthorized");
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

    return apiError(404, "Invalid URL");
};
*/
