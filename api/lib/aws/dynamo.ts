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

    #expiry(feature: any) {
        let time = new Date(feature.properties.stale || feature.properties.time || Date.now());
        time.setHours(time.getHours() + 24);
        return Math.round(time.getTime() / 1000);
    }

    async put(feature: any) {
        try {
            const ddb = new AWS.DynamoDB.DocumentClient({region: process.env.AWS_DEFAULT_REGION });

            await ddb.put({
                TableName: this.table,
                Item: {
                    LayerId: feature.layer,
                    Id: String(feature.id),
                    Expiry: this.#expiry(feature),
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
                            LayerId: feature.layer,
                            Id: String(feature.id),
                            Expiry: this.#expiry(feature),
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
