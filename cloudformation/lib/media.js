import cf from '@openaddresses/cloudfriend';

export default {
    Resources: {
        MediaSecurityGroup: {
            Type : 'AWS::EC2::SecurityGroup',
            Properties : {
                Tags: [{
                    Key: 'Name',
                    Value: cf.join('-', [cf.stackName, 'media-tasks'])
                }],
                GroupName: cf.join('-', [cf.stackName, 'media-tasks']),
                GroupDescription: 'Allow external access to Media Servers',
                SecurityGroupIngress: [{
                    CidrIp: '0.0.0.0/0',
                    IpProtocol: -1,
                    FromPort: 8554,
                    ToPort: 8554
                },{
                    CidrIp: '0.0.0.0/0',
                    IpProtocol: -1,
                    FromPort: 8889,
                    ToPort: 8889
                },{
                    CidrIp: '0.0.0.0/0',
                    IpProtocol: -1,
                    FromPort: 8890,
                    ToPort: 8890
                }],
                VpcId: cf.importValue(cf.join(['coe-vpc-', cf.ref('Environment'), '-vpc']))
            }
        }
    }
};
