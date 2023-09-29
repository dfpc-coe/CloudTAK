import DynamoDB from '@aws-sdk/client-dynamodb';
import DynamoDBDoc from "@aws-sdk/lib-dynamodb";
import Err from '@openaddresses/batch-error';
import { coordEach } from '@turf/meta';

export interface DynamoItem {
    Id: string;
    Properties: object;
    Expiry: number;
    LayerId: number;
    Geometry: object;
}

export interface DynamoQuery {
    filter?: string;
}

/**
 * @class
 */
export default class Dynamo {
    table: string;

    constructor(table: string) {
        this.table = table;
    }

    async query(layerid: number, query: DynamoQuery): Promise<DynamoItem[]> {
        try {
            const ddb = new DynamoDB.DynamoDBClient({region: process.env.AWS_DEFAULT_REGION });
            const ddbdoc = DynamoDBDoc.DynamoDBDocumentClient.from(ddb);

            let KeyConditionExpression: string = `LayerId = :layerid`;
            const ExpressionAttributeValues = new Map();
            ExpressionAttributeValues.set(':layerid', layerid);
            if (query.filter && query.filter.length) {
                KeyConditionExpression = KeyConditionExpression + ` and begins_with(Id, :filter)`;
                ExpressionAttributeValues.set(':filter', query.filter);
            }

            const list = await ddbdoc.send(new DynamoDBDoc.QueryCommand({
                TableName: this.table,
                KeyConditionExpression,
                ExpressionAttributeValues: Object.fromEntries(ExpressionAttributeValues)
            }));

            const items = list.Items as DynamoItem[];

            return items;
        } catch (err) {
            throw new Err(500, new Error(err), 'DynamoDB Query Failed');
        }
    }

    async row(layerid: number, id: string): Promise<DynamoItem> {
        try {
            const ddb = new DynamoDB.DynamoDBClient({region: process.env.AWS_DEFAULT_REGION });
            const ddbdoc = DynamoDBDoc.DynamoDBDocumentClient.from(ddb);

            const row = await ddbdoc.send(new DynamoDBDoc.GetCommand({
                TableName: this.table,
                Key: {
                    LayerId: layerid,
                    Id: id
                }
            }));

            return row.Item as DynamoItem;
        } catch (err) {
            throw new Err(500, new Error(err), 'DynamoDB Query Failed');
        }
    }

    #expiry(feature: any) {
        let time = new Date(feature.properties.stale || feature.properties.time || Date.now());
        time.setHours(time.getHours() + 24);
        return Math.round(time.getTime() / 1000);
    }

    async put(feature: any) {
        try {
            const ddb = new DynamoDB.DynamoDBClient({region: process.env.AWS_DEFAULT_REGION });
            const ddbdoc = DynamoDBDoc.DynamoDBDocumentClient.from(ddb);

            await ddbdoc.send(new DynamoDBDoc.PutCommand({
                TableName: this.table,
                Item: {
                    LayerId: feature.layer,
                    Id: String(feature.id),
                    Expiry: this.#expiry(feature),
                    Properties: feature.properties,
                    Geometry: feature.geometry
                }
            }));
        } catch (err) {
            throw new Err(500, new Error(err), 'DynamoDB putItem Failed');
        }
    }

    async puts(features: any[]) {
        try {
            const ddb = new DynamoDB.DynamoDBClient({region: process.env.AWS_DEFAULT_REGION });
            const ddbdoc = DynamoDBDoc.DynamoDBDocumentClient.from(ddb);

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

            await ddbdoc.send(new DynamoDBDoc.BatchWriteCommand(req));
        } catch (err) {
            console.error('DEBUG', JSON.stringify(features));
            throw new Err(500, new Error(err), 'DynamoDB batchWrite Failed');
        }
    }
}
