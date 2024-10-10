import AWSEC2 from '@aws-sdk/client-ec2';
import Err from '@openaddresses/batch-error';
import process from 'node:process';

/**
 * @class
 */
export default class EC2 {
    static async eni(eni: string): Promise<string | null> {
        try {
            const ec2 = new AWSEC2.EC2Client({ region: process.env.AWS_REGION });

            const res = await ec2.send(new AWSEC2.DescribeNetworkInterfacesCommand({
                NetworkInterfaceIds: [eni]
            }));

            if (!res.NetworkInterfaces || !res.NetworkInterfaces.length) return null;
            if (!res.NetworkInterfaces[0].Association) return null;

            return res.NetworkInterfaces[0].Association.PublicIp || null;
        } catch (err) {
            throw new Err(500, new Error(err instanceof Error ? err.message : String(err)), 'Failed to list ECR Tasks');
        }
    }
}
