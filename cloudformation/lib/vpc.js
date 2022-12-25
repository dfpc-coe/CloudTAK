import cf from '@mapbox/cloudfriend';

export default {
    Resources: {
        VPC: {
            Type: 'AWS::EC2::VPC',
            Properties: {
                EnableDnsHostnames: true,
                EnableDnsSupport: true,
                CidrBlock: '10.0.0.0/16',
                Tags: [{
                    Key: 'Name',
                    Value: cf.stackName
                }]
            }
        },
        SubnetA: {
            Type: 'AWS::EC2::Subnet',
            Properties: {
                AvailabilityZone: cf.findInMap('AWSRegion2AZ', cf.region, '1'),
                VpcId: cf.ref('VPC'),
                CidrBlock: '10.0.5.0/28',
                MapPublicIpOnLaunch: true,
                Tags: [{
                    Key: 'Name',
                    Value: cf.join('-', [cf.stackName, 'subnet-a'])
                }]
            }
        },
        SubnetB: {
            Type: 'AWS::EC2::Subnet',
            Properties: {
                AvailabilityZone: cf.findInMap('AWSRegion2AZ', cf.region, '2'),
                VpcId: cf.ref('VPC'),
                CidrBlock: '10.0.5.16/28',
                MapPublicIpOnLaunch: false,
                Tags: [{
                    Key: 'Name',
                    Value: cf.join('-', [cf.stackName, 'subnet-b'])
                }]
            }
        },
        RouteNATGateway : {
            DependsOn: ['NatGateway'],
            Type: 'AWS::EC2::Route',
            Properties : {
                RouteTableId : cf.ref('RouteTablePrivate'),
                DestinationCidrBlock : '0.0.0.0/0',
                NatGatewayId : cf.ref('NatGateway')
            }
        },
        InternetGateway: {
            Type: 'AWS::EC2::InternetGateway',
            Properties: {
                Tags: [{
                    Key: 'Name',
                    Value: cf.stackName
                },{
                    Key: 'Network',
                    Value: 'Public'
                }]
            }
        },
        VPCIG: {
            Type: 'AWS::EC2::VPCGatewayAttachment',
            Properties: {
                InternetGatewayId: cf.ref('InternetGateway'),
                VpcId: cf.ref('VPC')
            }
        },
        RouteTablePublic: {
            Type: 'AWS::EC2::RouteTable',
            Properties: {
                VpcId: cf.ref('VPC'),
                Tags: [{
                    Key: 'Name',
                    Value: cf.join('-', [cf.stackName, 'public'])
                },{
                    Key: 'Network',
                    Value: 'Public'
                }]
            }
        },
        RouteTablePrivate: {
            Type: 'AWS::EC2::RouteTable',
            Properties: {
                VpcId: cf.ref('VPC'),
                Tags: [{
                    Key: 'Name',
                    Value: cf.join('-', [cf.stackName, 'private'])
                },{
                    Key: 'Network',
                    Value: 'Public'
                }]
            }
        },
        PublicRoute: {
            Type: 'AWS::EC2::Route',
            DependsOn:  'VPCIG',
            Properties: {
                RouteTableId: cf.ref('RouteTablePublic'),
                DestinationCidrBlock: '0.0.0.0/0',
                GatewayId: cf.ref('InternetGateway')
            }
        },
        SubAAssoc: {
            Type: 'AWS::EC2::SubnetRouteTableAssociation',
            Properties: {
                RouteTableId: cf.ref('RouteTablePublic'),
                SubnetId: cf.ref('SubnetA')
            }
        },
        SubBAssoc: {
            Type: 'AWS::EC2::SubnetRouteTableAssociation',
            Properties: {
                RouteTableId: cf.ref('RouteTablePrivate'),
                SubnetId: cf.ref('SubnetB')
            }
        },
        NatGateway: {
            Type: 'AWS::EC2::NatGateway',
            DependsOn: 'NatPublicIP',
            Properties:  {
                AllocationId: cf.getAtt('NatPublicIP', 'AllocationId'),
                SubnetId: cf.ref('SubnetA')
            }
        },
        NatPublicIP: {
            Type: 'AWS::EC2::EIP',
            DependsOn: 'VPC',
            Properties: {
                Domain: 'vpc'
            }
        }
    },
    Mappings: {
        AWSRegion2AZ: {
            'us-east-1': { '1': 'us-east-1b', '2': 'us-east-1c', '3': 'us-east-1d', '4': 'us-east-1e' },
            'us-west-1': { '1': 'us-west-1b', '2': 'us-west-1c' },
            'us-west-2': { '1': 'us-west-2a', '2': 'us-west-2b', '3': 'us-west-2c'  }
        }
    }
};
