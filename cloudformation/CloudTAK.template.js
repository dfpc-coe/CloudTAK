import cf from '@openaddresses/cloudfriend';
import Media from './lib/media.js';
import S3 from './lib/s3.js';
import API from './lib/api.js';
import KMS from './lib/kms.js';
import Batch from './lib/batch.js';
import DB from './lib/db.js';
import Events from './lib/events.js';
import Hooks from './lib/hooks.js';
import Signing from './lib/signing.js';
import PMTiles from './lib/pmtiles.js';
import Stacks from './lib/stacks.js';
import Dynamo from './lib/dynamo.js';
import Alarms from './lib/alarms.js';
import {
    ELB as ELBAlarms,
    RDS as RDSAlarms
} from '@openaddresses/batch-alarms';

export default cf.merge(
    S3, DB, API, KMS, Batch, Hooks, Signing, Dynamo, Alarms, PMTiles, Events, Stacks, Media,
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
            MartiAPI: {
                Type: 'String',
                Description: 'Base URL of Marti API'
            },
            HostedURL: {
                Description: 'URL of domain/subdomain at which the API is hosted',
                Type: 'String'
            },
            SSLCertificateIdentifier: {
                Description: 'ACM SSL Certificate for HTTP Protocol',
                Type: 'String'
            }
        }
    },
    ELBAlarms({
        prefix: 'BatchELB',
        topic: cf.ref('HighUrgencyAlarmTopic'),
        apache: cf.stackName,
        cluster: cf.join(['coe-ecs-', cf.ref('Environment')]),
        service: cf.getAtt('Service', 'Name'),
        loadbalancer: cf.getAtt('ELB', 'LoadBalancerFullName'),
        targetgroup: cf.getAtt('TargetGroup', 'TargetGroupFullName')

    }),
    RDSAlarms({
        prefix: 'Batch',
        topic: cf.ref('HighUrgencyAlarmTopic'),
        instance: cf.ref('DBInstance')

    })
);
