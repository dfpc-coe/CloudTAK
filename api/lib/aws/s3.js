import AWS from 'aws-sdk';
import Err from '@openaddresses/batch-error';

/**
 * @class
 */
export default class S3 {
    constructor(params) {
        this.params = params;
    }

    static async head(key) {
        try {
            if (!process.env.ASSET_BUCKET) throw new Err(400, null, 'ASSET_BUCKET not set');

            const s3 = new AWS.S3({ region: process.env.AWS_DEFAULT_REGION });
            const head = await s3.headObject({
                Bucket: process.env.ASSET_BUCKET,
                Key: key
            }).promise();

            return head;
        } catch (err) {
            throw new Err(500, new Error(err), 'Failed to head file');
        }
    }

    static async put(key, stream) {
        try {
            if (!process.env.ASSET_BUCKET) throw new Err(400, null, 'ASSET_BUCKET not set');

            const s3 = new AWS.S3({ region: process.env.AWS_DEFAULT_REGION });
            await s3.upload({
                Bucket: process.env.ASSET_BUCKET,
                Key: key,
                Body: stream
            }).promise();
        } catch (err) {
            throw new Err(500, new Error(err), 'Failed to upload file');
        }
    }

    static async exists(key) {
        try {
            if (!process.env.ASSET_BUCKET) throw new Err(400, null, 'ASSET_BUCKET not set');

            const s3 = new AWS.S3({ region: process.env.AWS_DEFAULT_REGION });
            await s3.headObject({
                Bucket: process.env.ASSET_BUCKET,
                Key: key
            }).promise();
            return true;
        } catch (err) {
            if (err.code === 'NotFound') return false;

            throw new Err(500, new Error(err), 'Failed to determine existance');
        }
    }

    /**
     * List a key or prefix
     *
     * @param {string}  fragment             Key or Prefix to delete
     */
    static async list(fragment) {
        try {
            if (!process.env.ASSET_BUCKET) throw new Err(400, null, 'ASSET_BUCKET not set');

            const s3 = new AWS.S3({ region: process.env.AWS_DEFAULT_REGION });
            const list = await s3.listObjectsV2({
                Bucket: process.env.ASSET_BUCKET,
                Prefix: fragment
            }).promise();

            return list.Contents;
        } catch (err) {
            throw new Err(500, new Error(err), 'Failed to list files');
        }
    }

    /**
     * Delete a key or prefix
     *
     * @param {string}  key             Key or Prefix to delete
     * @param {object}  opts            Options
     * @param {boolean} [opts.recurse]      Recursive Delete on key
     */
    static async del(key, opts = {}) {
        if (!process.env.ASSET_BUCKET) return;
        const s3 = new AWS.S3({ region: process.env.AWS_DEFAULT_REGION });

        if (!opts.recurse) {
            try {
                await s3.deleteObject({
                    Bucket: process.env.ASSET_BUCKET,
                    Key: key
                }).promise();
            } catch (err) {
                throw new Err(500, new Error(err), 'Failed to delete file');
            }
        } else {
            try {
                const list = await this.list(key);

                await s3.deleteObjects({
                    Bucket: process.env.ASSET_BUCKET,
                    Delete: {
                        Objects: list.map((l) => {
                            return {
                                Key: l.Key
                            };
                        })
                    }
                }).promise();
            } catch (err) {
                throw new Err(500, new Error(err), 'Failed to delete files');
            }
        }
    }

    stream(res, name) {
        const s3 = new AWS.S3({ region: process.env.AWS_DEFAULT_REGION });
        const s3request = s3.getObject(this.params);
        const s3stream = s3request.createReadStream();

        s3request.on('httpHeaders', (statusCode, headers) => {
            headers['Content-disposition'] = `inline; filename="${name}"`;

            res.writeHead(statusCode, headers);
        });

        s3stream.on('error', (err) => {
            // Could not find object, ignore
            console.error(err);
        });

        s3stream.pipe(res);
    }
}
