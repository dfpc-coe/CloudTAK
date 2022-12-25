import cf from '@mapbox/cloudfriend';
import S3 from './lib/s3.js';
import VPC from './lib/vpc.js';
import KMS from './lib/kms.js';
import Batch from './lib/batch.js';

export default cf.merge(
    S3,
    VPC,
    KMS,
    Batch,
    {
        Description: 'Template for @tak-ps/etl',
        Parameters: {
            GitSha: {
                Description: 'GitSha that is currently being deployed',
                Type: 'String'
            }
        }
    }
);
