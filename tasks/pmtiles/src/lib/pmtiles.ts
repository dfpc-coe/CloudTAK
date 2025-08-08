import * as pmtiles from 'pmtiles';
import zlib from "zlib";
import Err from '@openaddresses/batch-error';
import {
    GetObjectCommand
} from '@aws-sdk/client-s3';
import S3Client from './s3.js';

const s3client = S3Client();

export async function nativeDecompress(
    buf: ArrayBuffer,
    compression: pmtiles.Compression
): Promise<ArrayBuffer> {
    if (compression === pmtiles.Compression.None || compression === pmtiles.Compression.Unknown) {
        return buf;
    } else if (compression === pmtiles.Compression.Gzip) {
        return zlib.gunzipSync(buf).buffer as ArrayBuffer;
    } else {
        throw Error("Compression method not supported");
    }
}

// Lambda needs to run with 512MB, empty function takes about 70
export const CACHE = new pmtiles.ResolvedValueCache(undefined, undefined, nativeDecompress);

export class S3Source implements pmtiles.Source {
    archive_name: string;

    constructor(archive_name: string) {
        this.archive_name = archive_name + '.pmtiles';
    }

    getKey() {
        return this.archive_name;
    }

    async getBytes(
        offset: number,
        length: number,
        signal?: AbortSignal,
        etag?: string
    ): Promise<pmtiles.RangeResponse> {
        try {
            const resp = await s3client.send(
                new GetObjectCommand({
                    Bucket: process.env.ASSET_BUCKET!,
                    Key: this.archive_name,
                    Range: "bytes=" + offset + "-" + (offset + length - 1),
                    IfMatch: etag,
                })
            );

            const arr = await resp.Body!.transformToByteArray();

            if (!arr) {
                throw new Err(500, null, "Failed to read S3 response body");
            }

            return {
                data: arr.buffer as ArrayBuffer,
                etag: resp.ETag,
                expires: resp.Expires?.toISOString(),
                cacheControl: resp.CacheControl,
            };
        } catch (err) {
            if (err instanceof Error && err.name === 'NoSuchKey') {
                throw new Err(404, err, 'Key not found');
            } else if (err instanceof Error && err.name === "PreconditionFailed") {
                throw new Err(400, err, 'ETag Mismatch');
            } else {
                throw new Err(500, err instanceof Error ? err : new Error(String(err)), 'Internal Server Error');
            }
        }
    }
}
