import AWS from 'aws-sdk';
import Err from '@openaddresses/batch-error';
import { coordEach } from '@turf/meta';

/**
 * @class
 */
export default class Dynamo {
    table: string;

    constructor(table: string) {
        this.table = table;
    }

    async put(feature: any) {
        try {
            const ddb = new AWS.DynamoDB.DocumentClient({region: process.env.AWS_DEFAULT_REGION });

            await ddb.put({
                TableName: this.table,
                Item: {
                    LayerId: feature.layer,
                    Id: String(feature.id),
                    Properties: feature.properties,
                    Geometry: feature.geometry
                }
            }).promise();
        } catch (err) {
            throw new Err(500, new Error(err), 'DynamoDB putItem Failed');
        }
    }

    async puts(features: any[]) {
        try {
            const ddb = new AWS.DynamoDB.DocumentClient({region: process.env.AWS_DEFAULT_REGION });

            const req: {
                RequestItems: any
            } = {
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
                            Geometry: feature.geometry
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
