import AWS from 'aws-sdk';
import Err from '@openaddresses/batch-error';
import { coordEach } from '@turf/meta';

/**
 * @class
 */
export default class Dynamo {
    constructor(table) {
        this.table = table;
    }

    async put(layer, feature) {
        try {
            const ddb = new AWS.DynamoDB.DocumentClient({region: process.env.AWS_DEFAULT_REGION });

            await ddb.put({
                TableName: this.table,
                Item: {
                    LayerId: layer.id,
                    Id: String(feature.id),
                    Properties: feature.properties,
                    Geometry: feature.geometry.type
                }
            }).promise();
        } catch (err) {
            throw new Err(500, new Error(err), 'Dynamo DB putItem Failed');
        }
    }
}
