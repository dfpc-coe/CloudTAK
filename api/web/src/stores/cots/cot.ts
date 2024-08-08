import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import type {
    Feature
} from '@tak-ps/node-cot';

export default class COT {
    id: string;
    type: string;
    properties: Static<typeof Feature.Properties>;
    geometry: Static<typeof Feature.Geometry>;

    constructor(feat: Static<typeof Feature.Feature>) {
        this.id = feat.id;
        this.type = feat.type;
        this.properties = feat.properties;
        this.geometry = feat.geometry;
    }
}
