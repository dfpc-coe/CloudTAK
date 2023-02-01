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
            const ddb = new AWS.DynamoDB({ region: process.env.AWS_DEFAULT_REGION });

            const props = {}
            for (const key in feature.properties) {
                if (typeof feature.properties[key] === 'string') {
                    props[key] = { S: feature.properties.key }
                } else {
                    props[key] = { S: JSON.stringify(feature.properties.key) }
                }
            }

            const geom = coordEach(JSON.parse(JSON.stringify(feature.geometry)), (coord) => {
                return coord.map((c) => { return String(c) });
            });

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
                        M: {
                            Type: { S: feature.geometry.type },
                            Coordinates: { NS: geom.coordinates }
                        }
                    }
                }
            }).promise();
        } catch (err) {
            throw new Err(500, new Error(err), 'Dynamo DB putItem Failed');
        }
    }
}
