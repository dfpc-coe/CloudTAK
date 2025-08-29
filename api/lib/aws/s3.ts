import type { S3ClientConfig } from '@aws-sdk/client-s3'
import * as S3AWS from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import Err from '@openaddresses/batch-error';
import { Readable } from 'node:stream';
import process from 'node:process';

/**
 * @class
 */
export default class S3 {
    static #client(): S3AWS.S3Client {
        if (!process.env.ASSET_BUCKET) throw new Err(400, null, 'ASSET_BUCKET not set');

        const config: S3ClientConfig = {
            region: process.env.AWS_REGION
        };

        if (process.env.AWS_S3_Endpoint) {
            config.endpoint = process.env.AWS_S3_Endpoint;
            config.forcePathStyle = true;

            if (!process.env.AWS_S3_AccessKeyId || !process.env.AWS_S3_SecretAccessKey) {
                throw new Error('Cannot use custom S3 Endpoint without providing AWS_S3_AccessKeyId & AWS_S3_SecretAccessKey');
            }

            config.credentials = {
                accessKeyId: process.env.AWS_S3_AccessKeyId,
                secretAccessKey: process.env.AWS_S3_SecretAccessKey
            }
        }

        return new S3AWS.S3Client(config);
    }

    static async head(key: string): Promise<S3AWS.HeadObjectCommandOutput> {
        try {
            const s3 = this.#client();

            const head = await s3.send(new S3AWS.HeadObjectCommand({
                Bucket: process.env.ASSET_BUCKET,
                Key: key
            }));

            return head;
        } catch (err) {
            console.error(`s3://${process.env.ASSET_BUCKET}/${key} - HEAD ERROR:`, err);
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to head file');
        }
    }

    static async put(key: string, body: Readable | string): Promise<void> {
        try {
            const s3 = this.#client();

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
            const s3 = this.#client();

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
            const s3 = this.#client();

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
            const s3 = this.#client();

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
        try {
            const s3 = this.#client();

            if (!opts.recurse) {
                await s3.send(new S3AWS.DeleteObjectCommand({
                    Bucket: process.env.ASSET_BUCKET,
                    Key: key
                }));
            } else {
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
            }
        } catch (err) {
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to delete files');
        }
    }
}
