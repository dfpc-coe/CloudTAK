import S3 from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@aws-sdk/node-http-handler";

export default function s3client(): S3.S3Client {
    // the region should default to the same one as the function
    const s3config: S3.S3ClientConfig = {
        region: process.env.AWS_REGION || 'us-east-1',
        requestHandler: new NodeHttpHandler({
            connectionTimeout: 500,
            socketTimeout: 500,
        }),
    }

    if (process.env.AWS_S3_Endpoint) {
        s3config.endpoint = process.env.AWS_S3_Endpoint;
        s3config.forcePathStyle = true;

        if (!process.env.AWS_S3_AccessKeyId || !process.env.AWS_S3_SecretAccessKey) {
            throw new Error('Cannot use custom S3 Endpoint without providing AWS_S3_AccessKeyId & AWS_S3_SecretAccessKey');
        }

        s3config.credentials = {
            accessKeyId: process.env.AWS_S3_AccessKeyId,
            secretAccessKey: process.env.AWS_S3_SecretAccessKey
        }
    }

    return new S3.S3Client(s3config);
}
