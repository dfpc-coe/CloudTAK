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
                    Description: 'RTSP Protocol',
                    CidrIp: '0.0.0.0/0',
                    IpProtocol: 'tcp',
                    FromPort: 8554,
                    ToPort: 8554
                },{
                    Description: 'WebRTC Protocol',
                    CidrIp: '0.0.0.0/0',
                    IpProtocol: 'tcp',
                    FromPort: 8889,
                    ToPort: 8889
                },{
                    Description: 'SRT Protocol',
                    CidrIp: '0.0.0.0/0',
                    IpProtocol: 'tcp',
                    FromPort: 8890,
                    ToPort: 8890
                },{
                    Description: 'HLS Protocol',
                    CidrIp: '0.0.0.0/0',
                    IpProtocol: 'tcp',
                    FromPort: 8888,
                    ToPort: 8888
                },{
                    Description: 'RTMP Protocol',
                    CidrIp: '0.0.0.0/0',
                    IpProtocol: 'tcp',
                    FromPort: 1935,
                    ToPort: 1935
                }],
                VpcId: cf.importValue(cf.join(['tak-vpc-', cf.ref('Environment'), '-vpc']))
            }
        }
    }
};
