import * as S3AWS from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import Err from '@openaddresses/batch-error';
import { Readable } from 'node:stream';
import process from 'node:process';

/**
 * @class
 */
export default class S3 {
    static async head(key: string): Promise<S3AWS.HeadObjectCommandOutput> {
        try {
            if (!process.env.ASSET_BUCKET) throw new Err(400, null, 'ASSET_BUCKET not set');

            const s3 = new S3AWS.S3Client({ region: process.env.AWS_REGION });
            const head = await s3.send(new S3AWS.HeadObjectCommand({
                Bucket: process.env.ASSET_BUCKET,
                Key: key
            }));

            return head;
        } catch (err) {
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to head file');
        }
    }

    static async put(key: string, body: Readable | string): Promise<void> {
        try {
            if (!process.env.ASSET_BUCKET) throw new Err(400, null, 'ASSET_BUCKET not set');

            const s3 = new S3AWS.S3Client({ region: process.env.AWS_REGION });

            const upload = new Upload({
                client: s3,
                params: {
                    Bucket: process.env.ASSET_BUCKET,
                    Key: key,
                    Body: body
                }
            });

            await upload.done();
        } catch (err) {
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to upload file');
        }
    }

    static async get(key: string): Promise<Readable> {
        try {
            if (!process.env.ASSET_BUCKET) throw new Err(400, null, 'ASSET_BUCKET not set');

            const s3 = new S3AWS.S3Client({ region: process.env.AWS_REGION });

            const res = await s3.send(new S3AWS.GetObjectCommand({
                Bucket: process.env.ASSET_BUCKET,
                Key: key
            }));

            const read = res.Body as Readable;
            return read;
        } catch (err) {
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to get file');
        }
    }

    static async exists(key: string): Promise<boolean> {
        try {
            if (!process.env.ASSET_BUCKET) throw new Err(400, null, 'ASSET_BUCKET not set');

            const s3 = new S3AWS.S3Client({ region: process.env.AWS_REGION });
            await s3.send(new S3AWS.HeadObjectCommand({
                Bucket: process.env.ASSET_BUCKET,
                Key: key
            }));
            return true;
        } catch (err) {
            if (String(err).startsWith('NotFound')) return false;
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to determine existance');
        }
    }

    /**
     * List a key or prefix
     *
     * @param {string}  fragment             Key or Prefix to delete
     */
    static async list(fragment: string): Promise<Array<S3AWS._Object>> {
        try {
            if (!process.env.ASSET_BUCKET) throw new Err(400, null, 'ASSET_BUCKET not set');

            const s3 = new S3AWS.S3Client({ region: process.env.AWS_REGION });
            const list = await s3.send(new S3AWS.ListObjectsV2Command({
                Bucket: process.env.ASSET_BUCKET,
                Prefix: fragment
            }));

            return list.Contents || [];
        } catch (err) {
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to list files');
        }
    }

    /**
     * Delete a key or prefix
     *
     * @param {string}  key             Key or Prefix to delete
     * @param {object}  opts            Options
     * @param {boolean} [opts.recurse]      Recursive Delete on key
     */
    static async del(key: string, opts: {
        recurse: boolean
    } = { recurse: false }): Promise<void> {
        if (!process.env.ASSET_BUCKET) return;
        const s3 = new S3AWS.S3Client({ region: process.env.AWS_REGION });

        if (!opts.recurse) {
            try {
                await s3.send(new S3AWS.DeleteObjectCommand({
                    Bucket: process.env.ASSET_BUCKET,
                    Key: key
                }));
            } catch (err) {
                throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to delete file');
            }
        } else {
            try {
                const list = await this.list(key);

                if (!list.length) return;

                await s3.send(new S3AWS.DeleteObjectsCommand({
                    Bucket: process.env.ASSET_BUCKET,
                    Delete: {
                        Objects: list.map((l) => {
                            return {
                                Key: l.Key
                            };
                        })
                    }
                }));
            } catch (err) {
                throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to delete files');
            }
        }
    }
}
