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

    async put(feature) {
        try {
            const ddb = new AWS.DynamoDB.DocumentClient({region: process.env.AWS_DEFAULT_REGION });

            await ddb.put({
                TableName: this.table,
                Item: {
                    LayerId: feature.layer,
                    Id: String(feature.id),
                    Properties: feature.properties,
                    Geometry: feature.geometry.type
                }
            }).promise();
        } catch (err) {
            throw new Err(500, new Error(err), 'DynamoDB putItem Failed');
        }
    }

    async puts(features) {
        try {
            const ddb = new AWS.DynamoDB.DocumentClient({region: process.env.AWS_DEFAULT_REGION });

            const req = {
                RequestItems: {}
            };

            req.RequestItems[this.table] = [];

            for (const feature of features) {
                req.RequestItems[this.table].push({
                    PutRequest: {
                        Item: {
                            LayerId: feature.id,
                            Id: String(feature.id),
                            Properties: feature.properties,
                            Geometry: feature.geometry.type
                        }
                    }
                });
            }

            await ddb.batchWrite(req).promise();
        } catch (err) {
            throw new Err(500, new Error(err), 'DynamoDB batchWrite Failed');
        }
    }
}
