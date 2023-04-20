import cf from '@openaddresses/cloudfriend';
import S3 from './lib/s3.js';
import API from './lib/api.js';
import KMS from './lib/kms.js';
import Batch from './lib/batch.js';
import DB from './lib/db.js';
import Signing from './lib/signing.js';
import PMTiles from './lib/pmtiles.js';
import Stats from './lib/stats.js';
import Dynamo from './lib/dynamo.js';
import {
    ELB as ELBAlarms,
    RDS as RDSAlarms
} from '@openaddresses/batch-alarms';

export default cf.merge(
    S3,
    DB,
    API,
    KMS,
    Batch,
    Signing,
    Dynamo,
    PMTiles,
    Stats,
    {
        Description: 'Template for @tak-ps/etl',
        Parameters: {
            GitSha: {
                Description: 'GitSha that is currently being deployed',
                Type: 'String'
            },
            HostedURL: {
                Description: 'URL of domain/subdomain at which the API is hosted',
                Type: 'String'
            },
            SSLCertificateIdentifier: {
                Description: 'ACM SSL Certificate for HTTP Protocol',
                Type: 'String'
            },
            AlarmEmail: {
                Description: 'Email to send alarms to',
                Type: 'String'
            },
            Username: {
                Type: 'String',
                Description: 'Temporary Username until LDAP lands'
            },
            Password: {
                Type: 'String',
                Description: 'Temporary Password until LDAP lands'
            }
        }
    },
    ELBAlarms({
        prefix: 'Batch',
        email: cf.ref('AlarmEmail'),
        apache: cf.stackName,
        cluster: cf.ref('ECSCluster'),
        service: cf.getAtt('Service', 'Name'),
        loadbalancer: cf.getAtt('ELB', 'LoadBalancerFullName'),
        targetgroup: cf.getAtt('TargetGroup', 'TargetGroupFullName')

    }),
    RDSAlarms({
        prefix: 'Batch',
        email: cf.ref('AlarmEmail'),
        instance: cf.ref('DBInstance')

    })
);
