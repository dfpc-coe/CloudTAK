import cf from '@mapbox/cloudfriend';
import S3 from './lib/s3.js';
import API from './lib/api.js';
import KMS from './lib/kms.js';
import Batch from './lib/batch.js';
import DB from './lib/db.js';
import Signing from './lib/signing.js';
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
    {
        Description: 'Template for @tak-ps/etl',
        Parameters: {
            GitSha: {
                Description: 'GitSha that is currently being deployed',
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
