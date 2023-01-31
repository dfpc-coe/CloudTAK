import AWS from 'aws-sdk';
import Err from '@openaddresses/batch-error';

/**
 * @class
 */
export default class Dynamo {
    constructor(table) {
        this.table = table;
    }

    async put(layer, feature) {
        try {
            const ddb = new AWS.DynamoDB({ region: process.env.AWS_DEFAULT_REGION });

            await ddb.putItem({
                Item: {
                    LayerId: {
                        N: layer.id
                    },
                    Id: {
                        S: String(feature.id)
                    },
                    Properties: {
                        M: feature.properties
                    },
                    Geometry: {
                        M: feature.geometry
                    }
                }
            }).promise();
        } catch (err) {
            throw new Err(500, new Error(err), 'Failed to enable rule');
        }
    }
}
