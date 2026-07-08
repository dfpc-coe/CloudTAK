import cf from '@openaddresses/cloudfriend';
import Media from './lib/media.js';
import S3 from './lib/s3.js';
import API from './lib/api.js';
import KMS from './lib/kms.js';
import DB from './lib/db.js';
import Signing from './lib/signing.js';
import Events from './lib/events.js';
import PMTiles from './lib/pmtiles.js';
import Retention from './lib/retention.js';
import Alarms from './lib/alarms.ts';
import Dashboard from './lib/dashboard.ts';

export default cf.merge(
    S3, DB, API, KMS, Signing, Alarms, Dashboard, PMTiles, Events, Retention, Media,
    {
        Description: 'Template for @tak-ps/etl',
        Parameters: {
            GitSha: {
                Description: 'GitSha that is currently being deployed',
                Type: 'String'
            },
            Environment: {
                Description: 'VPC/ECS Stack to deploy into',
                Type: 'String',
                Default: 'prod'
            },
            EnableExecute: {
                Description: 'Allow SSH into docker container - should only be enabled for limited debugging',
                Type: 'String',
                AllowedValues: ['true', 'false'],
                Default: 'false'
            }
        }
    }
);
