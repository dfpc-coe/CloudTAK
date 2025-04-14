import AWSS3 from '@aws-sdk/client-s3';
import Err from '@openaddresses/batch-error';
import Schema from '@openaddresses/batch-schema';
import { Type } from '@sinclair/typebox'
import auth from '../lib/auth.js';

export default async function router(schema: Schema) {
    schema.get('/tiles/public', {
        name: 'Get Sources',
        group: 'PublicTiles',
        description: 'Return a list of public tile sources',
        query: Type.Object({
            token: Type.String()
        }),
        res: Type.Object({
            total: Type.Integer(),
            items: Type.Array(Type.Object({
                name: Type.String(),
                hash: Type.String(),
                updated: Type.String(),
                size: Type.Integer(),
            }))
        })
    }, async (req, res) => {
        try {
            auth(req.query.token);

            const client = new AWSS3.S3Client();

            const Contents = [];

            let s3res;
            do {
                const req: AWSS3.ListObjectsV2CommandInput = {
                    Bucket: process.env.ASSET_BUCKET,
                    Prefix: 'public/'
                };

                if (s3res && s3res.NextContinuationToken) {
                    req.ContinuationToken = s3res.NextContinuationToken;
                }

                s3res = await client.send(new AWSS3.ListObjectsV2Command(req))

                Contents.push(...((s3res.Contents || []).filter((Content) => {
                    return (Content.Key || '').endsWith('.pmtiles')
                }) || []));
            } while (s3res.NextContinuationToken)

            res.json({
                total: Contents.length,
                items: Contents
                    .filter((Content) => {
                        return Content.ETag && Content.Key
                    }) 
                    .map((Content) => {
                        return {
                            name: (Content.Key || ''),
                            hash: JSON.parse(Content.ETag || '""'),
                            updated: Content.LastModified ? Content.LastModified.toISOString() : new Date().toISOString(),
                            size: Content.Size || 0
                        }
                    })
            })
        } catch (err) {
            Err.respond(err, res);
        }
    });
}
