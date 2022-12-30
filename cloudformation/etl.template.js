import cf from '@mapbox/cloudfriend';
import S3 from './lib/s3.js';
import API from './lib/api.js';
import KMS from './lib/kms.js';
import Batch from './lib/batch.js';
import DB from './lib/db.js';

export default cf.merge(
    S3,
    DB,
    API,
    KMS,
    Batch,
    {
        Description: 'Template for @tak-ps/etl',
        Parameters: {
            GitSha: {
                Description: 'GitSha that is currently being deployed',
                Type: 'String'
            },
            VPC: {
                Description: 'VPC ID to deploy into',
                Type: 'String'
            },
            SubnetPublicA: {
                Description: 'VPC SubnetPublicA to deploy into',
                Type: 'String'
            },
            SubnetPublicB: {
                Description: 'VPC SubnetPublicB to deploy into',
                Type: 'String'
            },
            SubnetPrivateA: {
                Description: 'VPC SubnetPrivateA to deploy into',
                Type: 'String'
            },
            SubnetPrivateB: {
                Description: 'VPC SubnetPrivateB to deploy into',
                Type: 'String'
            }
        }
    }
);
